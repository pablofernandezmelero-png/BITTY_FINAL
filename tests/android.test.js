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
    Object.defineProperty(w.navigator,"language",{value:"es-ES",configurable:true});
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    const A = cap.ad;
    w.Capacitor = { isNativePlatform: () => true, Plugins: {
      App: { addListener(n, f) { if (n === "backButton") cap.cb = f; if (n === "appUrlOpen") cap.deep = f; }, exitApp() { cap.exited++; } },
      AdMob: {
        async requestConsentInfo() { A.calls.push("consent"); return { status: "NOT_REQUIRED", isConsentFormAvailable: false, canRequestAds: true }; },
        async initialize(o) { A.calls.push("init"); A.opts.init = o; },
        addListener(n, f) { (A.listeners[n] = A.listeners[n] || []).push(f); return Promise.resolve({ remove() {} }); },
        async showBanner(o) { A.calls.push("showBanner"); A.opts.banner = o; },
        async hideBanner() { A.calls.push("hideBanner"); },
        async removeBanner() { A.calls.push("banner-removed"); },
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
// Solo el texto VISIBLE: el <body> también contiene el código del script, con todos los textos de la interfaz
const VISTXT = () => (w.document.querySelector("#app") || { textContent: "" }).textContent + " " + [...w.document.querySelectorAll("#tst,#offb")].map(e => e.textContent).join(" ");
const back = () => cap.cb && cap.cb({ canGoBack: false });
(async () => {
  await sleep(600);
  ok("se registra el listener de backButton", typeof cap.cb === "function");
  ev(`S.lang="es";S.name="Ana";S.track="g";S.dif=1;AS=0;tab="r";home()`);
  // raíz: primera pulsación avisa, segunda sale
  back(); ok("en la raíz: 1ª pulsación avisa y NO sale", cap.exited === 0 && /otra vez para salir/.test(VISTXT()));
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
  // ----- el banner (vista nativa) no debe tapar la barra de navegación inferior: su margen sale del alto REAL de la barra -----
  const showAt = async (h, inset) => {
    ev(`window.getComputedStyle=e=>({paddingBottom:"${inset || 0}px"});document.querySelector("#nav").getBoundingClientRect=()=>({height:${h}})`);
    ev(`go(0)`); await sleep(60); ev(`tab="r";home()`); await sleep(80);
    return lastBan() === "showBanner" ? A.opts.banner.margin : null;
  };
  const m73 = await showAt(73);
  ok("barra de 73 px: margen 79 (alto + 6 de hueco), no el 72 fijo de antes", m73 === 79);
  const m99 = await showAt(99);
  ok("letra grande en el móvil (barra de 99 px): el margen sube a 105 y sigue sin tapar", m99 === 105);
  const mIn = await showAt(107, 34);
  ok("con zona segura inferior de 34 px (ya incluida en el alto de la barra y que el plugin suma aparte): margen 79", mIn === 79);
  let neverCovers = true;
  for (const h of [50, 60, 73, 80, 99, 121, 160, 200]) { const m = await showAt(h); if (!(m >= h + 6)) neverCovers = false; }
  ok("para cualquier alto de barra (50–200 px) el margen es siempre ≥ alto + 6: nunca la tapa", neverCovers);
  const m0 = await showAt(0);
  ok("si no se puede medir la barra, usa el respaldo seguro de 80", m0 === 80);
  ok("se respetan las dimensiones del anuncio de AdMob: banner adaptable, abajo y centrado, sin forzar tamaño", A.opts.banner.adSize === "ADAPTIVE_BANNER" && A.opts.banner.position === "BOTTOM_CENTER" && !("width" in A.opts.banner) && !("height" in A.opts.banner));
  await showAt(73);
  (A.listeners.bannerAdSizeChanged || []).forEach(f => f({ width: 360, height: 60 }));
  ok("el contenido deslizable deja sitio al banner (alto 60 + 6 de hueco)", ev(`document.documentElement.style.getPropertyValue("--adh")`) === "66px");
  ok("la hoja de estilos reserva ese espacio al final de la zona de contenido", /main\{[^}]*padding:16px 16px calc\(16px \+ var\(--adh,0px\)\)/.test(html));
  ev(`go(0)`); await sleep(60);
  ok("al ocultar el banner se libera el espacio", ev(`document.documentElement.style.getPropertyValue("--adh")`) === "0px");
  ev(`tab="r";home()`); await sleep(80);
  (A.listeners.bannerAdSizeChanged || []).forEach(f => f({ width: 0, height: 0 }));
  ok("un banner de alto 0 no reserva espacio", ev(`document.documentElement.style.getPropertyValue("--adh")`) === "0px");
  // si cambia el alto de la barra con el banner puesto (girar, tamaño de letra), se recoloca
  await showAt(73); A.calls.length = 0;
  ev(`document.querySelector("#nav").getBoundingClientRect=()=>({height:99})`);
  w.dispatchEvent(new w.Event("resize")); await sleep(600);
  ok("al cambiar el alto de la barra el banner se quita y se vuelve a poner con el margen nuevo (105)", A.calls.includes("banner-removed") && lastBan() === "showBanner" && A.opts.banner.margin === 105);
  A.calls.length = 0; w.dispatchEvent(new w.Event("resize")); await sleep(600);
  ok("si el alto no cambia, no se toca el banner (sin parpadeos)", !A.calls.includes("banner-removed") && A.calls.length === 0);
  ev(`delete window.getComputedStyle`); ev(`document.querySelector("#nav").getBoundingClientRect=Element.prototype.getBoundingClientRect`);
  ev(`wl()`); await sleep(80); ok("banner oculto en el login", lastBan() === "hideBanner");
  ev(`AS=0;tab="p";home()`); await sleep(80);
  ok("el perfil ofrece el bonus de vídeo", /Bonus de bytes/.test(VISTXT()) && /Ver vídeo/.test(VISTXT()));
  const xp0 = ev(`S.xp`); A.calls.length = 0;
  ev(`adWatch()`); await sleep(150);
  ok("ver el vídeo usa el ID de prueba y concede +10", A.opts.rewarded.adId === "ca-app-pub-3940256099942544/5224354917" && A.opts.rewarded.isTesting === true && ev(`S.xp`) === xp0 + 10);
  const xq = JSON.parse(w.localStorage.getItem("bitty_xq") || "[]"), ev1 = xq[xq.length - 1];
  ok("el bonus se encola como evento 'ad' validable por el servidor", ev1 && ev1.kind === "ad" && ev1.xp === 10 && /^ad:\d{4}-\d{2}-\d{2}:1$/.test(ev1.ref) && ev1.ref.split(":")[1] === ev1.day);
  A.calls.length = 0; ev(`adWatch()`); await sleep(100);
  ok("control de frecuencia: no hay segundo vídeo seguido", !A.calls.includes("showReward") && /Espera/.test(VISTXT()));
  w.localStorage.setItem("bitty_ads", JSON.stringify({ d: ev(`dstr(new Date())`), n: 1, t: 0 })); A.reward = false; const xp1 = ev(`S.xp`);
  ev(`adWatch()`); await sleep(150); ok("si no se completa el vídeo, no hay bonus", ev(`S.xp`) === xp1 && /no hay bonus/.test(VISTXT()));
  A.reward = true;
  w.localStorage.setItem("bitty_ads", JSON.stringify({ d: ev(`dstr(new Date())`), n: 3, t: 0 })); A.calls.length = 0;
  ev(`adWatch()`); await sleep(100); ok("límite diario: 3 bonus", !A.calls.includes("showReward") && /todos los bonus/.test(VISTXT()));
  w.localStorage.setItem("bitty_ads", JSON.stringify({ d: ev(`dstr(new Date())`), n: 0, t: 0 })); A.calls.length = 0;
  ev(`go(0)`); ev(`adWatch()`); await sleep(100); ok("no se puede lanzar un anuncio durante un nivel", !A.calls.includes("showReward") && !A.calls.includes("prepare"));
  ev(`home()`);
  ok("solo hay IDs de prueba de Google en el código", !/ca-app-pub-(?!3940256099942544)/.test(html));
  // ===== enlace profundo y manifiesto (confirmación de correo) =====
  ev(`S.lang="es";AS=1;AU=null;amode="i";wl()`);
  ok("se registra el listener appUrlOpen", typeof cap.deep === "function");
  cap.deep({ url: "com.bitty.app://confirmed" }); await sleep(30);
  ok("com.bitty.app://confirmed en la pantalla de acceso: «¡Correo confirmado!» y deja iniciar sesión", /¡Correo confirmado! Ya puedes iniciar sesión/.test(w.document.querySelector("#app").textContent) && !!w.document.querySelector("#cE"));
  for (const bad of ["com.bitty.app://confirmed?token_hash=abc", "com.bitty.app://confirmed#access_token=x", "com.bitty.app://otra", "https://evil.example/confirmed", "otro.esquema://confirmed", "no es una url", ""]) {
    ev(`AS=1;cmsg="";wl()`); cap.deep({ url: bad }); await sleep(20);
    ok(`enlace profundo no admitido ignorado: «${bad}»`, !/Correo confirmado/.test(w.document.querySelector("#app").textContent) && ev(`AU`) === null);
  }
  ev(`AS=0;tab="r";home();go(0)`); cap.deep({ url: "com.bitty.app://confirmed" }); await sleep(30);
  ok("con una partida en curso el enlace no interrumpe: solo un aviso", !!w.document.querySelector('[onclick="xq()"]'));
  ev(`home()`);
  ev(`bwnp()`); ok("pantalla de nueva contraseña visible", !!w.document.querySelector("#cN1"));
  back(); ok("botón atrás en la pantalla de contraseña: vuelve al perfil sin salir de la app", !w.document.querySelector("#cN1") && ev(`tab`) === "p");
  const mf = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  const filters = [...mf.matchAll(/<intent-filter>[\s\S]*?<\/intent-filter>/g)].map(m => m[0]);
  const browsable = filters.filter(f => /BROWSABLE/.test(f));
  ok("manifiesto: un único filtro BROWSABLE, solo com.bitty.app://confirmed", browsable.length === 1 && /android:scheme="com\.bitty\.app"/.test(browsable[0]) && /android:host="confirmed"/.test(browsable[0]));
  ok("manifiesto: sin App Links https ni autoVerify (requieren un dominio propio con assetlinks.json)", !/android:scheme="https?"/.test(mf) && !/autoVerify/.test(mf));
  ok("manifiesto: solo la actividad principal está exportada", (mf.match(/android:exported="true"/g) || []).length === 1);
  // iconos propios de Bitty (no los de Capacitor): dimensiones reales por densidad y fondo del icono adaptable
  const fsx = require("fs"), pngWH = f => { const b = fsx.readFileSync(f); return b.slice(1, 4).toString() === "PNG" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
  const RES = "android/app/src/main/res/", DENS = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
  for (const [d, [l, f]] of Object.entries(DENS)) {
    const a = pngWH(RES + "mipmap-" + d + "/ic_launcher.png"), b = pngWH(RES + "mipmap-" + d + "/ic_launcher_round.png"), c = pngWH(RES + "mipmap-" + d + "/ic_launcher_foreground.png");
    ok("icono " + d + ": ic_launcher " + l + "px, round " + l + "px y primer plano " + f + "px", !!a && !!b && !!c && a[0] === l && a[1] === l && b[0] === l && b[1] === l && c[0] === f && c[1] === f);
  }
  ok("fondo del icono adaptable = morado de Bitty", /#6D4AFF/i.test(fsx.readFileSync(RES + "values/ic_launcher_background.xml", "utf8")));
  console.log(out.join("\n")); console.log("ERRORES JS:", errs.length); errs.forEach(e => console.log(e));
  process.exit(out.some(x => x.startsWith("FALLO")) || errs.length ? 1 : 0);
})();
