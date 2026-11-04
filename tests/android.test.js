// Comportamiento propio de Android: botón atrás y aviso sin conexión (con un Capacitor simulado).
// No sustituye a probar la APK en un móvil.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const html = fs.readFileSync(process.argv[2] || "www/index.html", "utf8")
  .replace(/const SB={[^}]*};/, 'const SB={url:"https://abc.supabase.co",key:"k".repeat(30)};')
  .replace(/<link[^>]*fonts.googleapis[^>]*>/g, "");
const errs = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errs.push("JSDOM: " + (e.detail && e.detail.stack || e.message)));
vc.on("error", (...a) => errs.push("console.error: " + a.join(" ")));
const cap = { cb: null, exited: 0, ad: { calls: [], listeners: {}, reward: true, opts: {} } };
const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "http://localhost/",
  beforeParse(w) {
    w.Element.prototype.scrollIntoView = () => {};
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    const A = cap.ad;
    w.Capacitor = { isNativePlatform: () => true, Plugins: {
      App: { addListener(n, f) { if (n === "backButton") cap.cb = f; }, exitApp() { cap.exited++; } },
      AdMob: {
        async requestConsentInfo() { A.calls.push("consent"); return { status: "NOT_REQUIRED", isConsentFormAvailable: false, canRequestAds: true }; },
        async initialize(o) { A.calls.push("init"); A.opts.init = o; },
        addListener(n, f) { (A.listeners[n] = A.listeners[n] || []).push(f); return Promise.resolve({ remove() {} }); },
        async showBanner(o) { A.calls.push("showBanner"); A.opts.banner = o; },
        async hideBanner() { A.calls.push("hideBanner"); },
        async prepareRewardVideoAd(o) { A.calls.push("prepare"); A.opts.rewarded = o; },
        async showRewardVideoAd() { A.calls.push("showReward"); if (A.reward) (A.listeners.onRewardedVideoAdReward || []).forEach(f => f({ type: "bytes", amount: 1 })); return { type: "bytes", amount: 1 }; }
      } } };
    w.localStorage.setItem("bitty_guest", "1");
  }
});
const w = dom.window;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = [], ok = (n, c) => out.push((c ? "ok  " : "FALLO ") + n);
const ev = s => w.eval(s);
const back = () => cap.cb && cap.cb({ canGoBack: false });
(async () => {
  await sleep(600);
  ok("se registra el listener de backButton", typeof cap.cb === "function");
  ev(`S.lang="es";S.name="Ana";S.track="g";S.dif=1;AS=0;tab="r";home()`);
  // raíz: primera pulsación avisa, segunda sale
  back(); ok("en la raíz: 1ª pulsación avisa y NO sale", cap.exited === 0 && /otra vez para salir/.test(w.document.body.textContent));
  back(); ok("en la raíz: 2ª pulsación seguida sale", cap.exited === 1);
  // pestañas
  ev(`tab="p";home()`); back(); ok("desde Perfil vuelve a Ruta", ev(`tab`) === "r");
  ev(`tab="s";home()`); back(); ok("desde Especiales vuelve a Ruta", ev(`tab`) === "r");
  // nivel
  ev(`go(0)`); ok("hay un nivel en curso", !!w.document.querySelector('[onclick="xq()"]'));
  back(); ok("en un nivel sin progreso: sale al inicio sin salir de la app", !w.document.querySelector('[onclick="xq()"]') && cap.exited === 1);
  ev(`go(0);L.ok=1`); w.confirm = () => false; back();
  ok("en un nivel con progreso y 'cancelar': se queda", !!w.document.querySelector('[onclick="xq()"]'));
  w.confirm = () => true; back();
  ok("en un nivel con progreso y 'aceptar': vuelve al inicio", !w.document.querySelector('[onclick="xq()"]'));
  // pantalla de resultado
  ev(`go(0);fin(0)`); ok("pantalla de resultado visible", !!w.document.querySelector(".fin"));
  back(); ok("desde el resultado vuelve al inicio", !w.document.querySelector(".fin"));
  // 2FA al iniciar sesión
  ev(`MP={r:{},fid:"x",next:()=>{}};wmfa()`); ok("pantalla 2FA visible", !!w.document.querySelector("#cM"));
  back(); ok("desde el código 2FA vuelve al login", !w.document.querySelector("#cM") && !!w.document.querySelector("#cE") && ev(`MP`) === null);
  // login: atrás sale de la app
  const antes = cap.exited; back(); back();
  ok("en el login, atrás dos veces seguidas sale", cap.exited === antes + 1);
  // conexión
  Object.defineProperty(w.navigator, "onLine", { value: false, configurable: true });
  w.dispatchEvent(new w.Event("offline"));
  const b = w.document.querySelector("#offb");
  ok("sin conexión aparece el aviso", b && b.style.display === "block" && /Sin conexión/.test(b.textContent));
  Object.defineProperty(w.navigator, "onLine", { value: true, configurable: true });
  w.dispatchEvent(new w.Event("online"));
  ok("al volver la conexión desaparece el aviso", w.document.querySelector("#offb").style.display === "none");
  // ===== Anuncios (AdMob simulado) =====
  const A = cap.ad, lastBan = () => { for (let i = A.calls.length - 1; i >= 0; i--) if (/Banner$/.test(A.calls[i])) return A.calls[i]; return null; };
  A.calls.length = 0;
  ev(`tab="r";home()`); await sleep(80);
  ok("banner visible en el inicio, con ID de PRUEBA y isTesting", lastBan() === "showBanner" && A.opts.banner.adId === "ca-app-pub-3940256099942544/6300978111" && A.opts.banner.isTesting === true);
  ok("SDK inicializado en modo de pruebas tras pedir consentimiento", A.opts.init && A.opts.init.initializeForTesting === true && A.calls.indexOf("consent") < A.calls.indexOf("init"));
  ev(`go(0)`); await sleep(80); ok("banner oculto dentro de un nivel", lastBan() === "hideBanner");
  ev(`fin(0)`); await sleep(80); ok("banner oculto en el resultado", lastBan() === "hideBanner");
  ev(`home()`); await sleep(80); ok("banner vuelve en el inicio", lastBan() === "showBanner");
  ev(`wl()`); await sleep(80); ok("banner oculto en el login", lastBan() === "hideBanner");
  ev(`AS=0;tab="p";home()`); await sleep(80);
  ok("el perfil ofrece el bonus de vídeo", /Bonus de bytes/.test(w.document.body.textContent) && /Ver vídeo/.test(w.document.body.textContent));
  const xp0 = ev(`S.xp`); A.calls.length = 0;
  ev(`adWatch()`); await sleep(150);
  ok("ver el vídeo usa el ID de prueba y concede +10", A.opts.rewarded.adId === "ca-app-pub-3940256099942544/5224354917" && A.opts.rewarded.isTesting === true && ev(`S.xp`) === xp0 + 10);
  const xq = JSON.parse(w.localStorage.getItem("bitty_xq") || "[]"), ev1 = xq[xq.length - 1];
  ok("el bonus se encola como evento 'ad' validable por el servidor", ev1 && ev1.kind === "ad" && ev1.xp === 10 && /^ad:\d{4}-\d{2}-\d{2}:1$/.test(ev1.ref) && ev1.ref.split(":")[1] === ev1.day);
  A.calls.length = 0; ev(`adWatch()`); await sleep(100);
  ok("control de frecuencia: no hay segundo vídeo seguido", !A.calls.includes("showReward") && /Espera/.test(w.document.body.textContent));
  w.localStorage.setItem("bitty_ads", JSON.stringify({ d: ev(`dstr(new Date())`), n: 1, t: 0 })); A.reward = false; const xp1 = ev(`S.xp`);
  ev(`adWatch()`); await sleep(150); ok("si no se completa el vídeo, no hay bonus", ev(`S.xp`) === xp1 && /no hay bonus/.test(w.document.body.textContent));
  A.reward = true;
  w.localStorage.setItem("bitty_ads", JSON.stringify({ d: ev(`dstr(new Date())`), n: 3, t: 0 })); A.calls.length = 0;
  ev(`adWatch()`); await sleep(100); ok("límite diario: 3 bonus", !A.calls.includes("showReward") && /todos los bonus/.test(w.document.body.textContent));
  w.localStorage.setItem("bitty_ads", JSON.stringify({ d: ev(`dstr(new Date())`), n: 0, t: 0 })); A.calls.length = 0;
  ev(`go(0)`); ev(`adWatch()`); await sleep(100); ok("no se puede lanzar un anuncio durante un nivel", !A.calls.includes("showReward") && !A.calls.includes("prepare"));
  ev(`home()`);
  ok("solo hay IDs de prueba de Google en el código", !/ca-app-pub-(?!3940256099942544)/.test(html));
  console.log(out.join("\n")); console.log("ERRORES JS:", errs.length); errs.forEach(e => console.log(e));
  process.exit(out.some(x => x.startsWith("FALLO")) || errs.length ? 1 : 0);
})();
