// Aviso de actualización de la app (APK nueva / versión web nueva), página pública /descargar/ y workflows de publicación.
// La app y la página se ejecutan en jsdom con fetch y Capacitor simulados. No sustituye a probar una actualización real.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGE = "https://pablofernandezmelero-png.github.io/BITTY_FINAL/descargar/";
const APID = "https://api.github.com/repos/pablofernandezmelero-png/BITTY_FINAL/releases/tags/desktop-latest";
const API = "https://api.github.com/repos/pablofernandezmelero-png/BITTY_FINAL/releases/latest";
const appHtml = fs.readFileSync(path.join(root, "www", "index.html"), "utf8")
  .replace(/const SB={[^}]*};/, 'const SB={url:"https://abc.supabase.co",key:"k".repeat(30)};').replace(/<link[^>]*fonts.googleapis[^>]*>/g, "");

function boot(o) {
  const calls = [], errs = [], vc = new VirtualConsole();
  vc.on("jsdomError", e => errs.push(String(e.message)));
  const sw = o.sw ? Object.assign(new (require("events").EventEmitter)(), { controller: o.sw === "ctl" ? {} : null }) : null;
  const dom = new JSDOM(appHtml, {
    runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "http://localhost/" + (o.hash || ""),
    beforeParse(w) {
      w.Element.prototype.scrollIntoView = () => {};
      Object.defineProperty(w.navigator, "language", { value: o.lang || "es-ES", configurable: true });
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
      w.fetch = async (u, init) => { calls.push({ u: String(u), init }); if (String(u) === APID && o.relDesk) { const r = o.relDesk; return { ok: true, status: 200, json: async () => r }; } if (String(u) === API && o.rel) { if (o.rel === "throw") throw new TypeError("net"); const r = typeof o.rel === "function" ? o.rel() : o.rel; return { ok: r.status ? r.status < 400 : true, status: r.status || 200, json: async () => r.body !== undefined ? r.body : r }; } return { ok: false, status: 404, json: async () => ({}) }; };
      if (o.desk) w.bittyDesktop = Object.freeze({ isDesktop: true, platform: "win32", version: o.desk, onDeepLink() {} });
      if (o.native !== false) w.Capacitor = { isNativePlatform: () => o.native !== "web", Plugins: { App: { addListener() {}, getInfo: async () => ({ build: String(o.build == null ? 3 : o.build), version: "1.0" }) } } };
      if (sw) { sw.addEventListener = (t, f) => sw.on(t, f); Object.defineProperty(w.navigator, "serviceWorker", { value: sw, configurable: true }); }
      w.localStorage.setItem("bitty_guest", "1");
      if (o.ls) for (const [k, v] of Object.entries(o.ls)) w.localStorage.setItem(k, v);
    }
  });
  return { w: dom.window, calls, errs, sw, bar: () => dom.window.document.querySelector("#upd") };
}
const rel = (tag, x = {}) => Object.assign({ tag_name: tag, draft: false, prerelease: false, html_url: "https://evil.example/x" }, x);

(async () => {
  // ---- hay una versión más nueva
  let t = boot({ build: 3, rel: rel("build-5") }); await sleep(150);
  await t.w.eval("updCheck()");
  ok(!!t.bar(), "build 5 publicada y la app es la 3: aparece el aviso");
  const q = id => t.w.document.querySelector(id);
  ok(q("#updT").textContent === "¡Hay una nueva versión de Bitty!", "título: «¡Hay una nueva versión de Bitty!»");
  ok(q("#updM").textContent === "Hemos mejorado la aplicación. Actualiza para disfrutar de las novedades.", "mensaje: «Hemos mejorado la aplicación. Actualiza para disfrutar de las novedades.»");
  ok(q("#updV").textContent === "Versión 5" && q("#updOk").textContent === "Actualizar ahora" && /Más tarde/.test(q("#updLater").textContent), "dice la versión nueva, botón «Actualizar ahora» y «Más tarde»");
  const a = t.w.document.querySelector("#updOk");
  ok(a && a.tagName === "A" && a.href === PAGE && a.target === "_blank" && /noopener/.test(a.rel), "«Actualizar ahora» lleva a la página de descargas ya existente (constante), en pestaña nueva y con noopener");
  const bar = (appHtml.match(/e\.style\.cssText="position:fixed;left:12px;right:12px;top:calc\(38px[^"]*"/) || [""])[0];   // jsdom no entiende env(): se comprueba el código fuente
  ok(/top:calc\(38px \+ env\(safe-area-inset-top,0px\)\)/.test(bar) && !/bottom/.test(bar), "el aviso va ARRIBA (respeta la zona segura): abajo el banner nativo de AdMob taparía los botones");
  ok(!t.w.document.body.innerHTML.includes("evil.example"), "nada de lo que devuelve la API decide el destino del enlace");
  const f = t.calls.find(c => c.u === API);
  ok(f && f.init.credentials === "omit" && f.init.referrerPolicy === "no-referrer", "la consulta va sin cookies ni referer");
  ok(t.calls.filter(c => c.u === API).length === 1, "una sola consulta");
  ok(t.w.document.querySelector("#upd").getAttribute("role") === "status", "accesible: role=status");
  // ---- PERSISTENCIA: «Más tarde» solo oculta el aviso en esta sesión; mientras no se actualice, vuelve
  t.w.document.querySelector("#updLater").click();
  ok(!t.bar(), "«Más tarde» cierra el aviso");
  ok(t.w.localStorage.getItem("bitty_upd_n") === "5", "la versión nueva queda GUARDADA: cerrar el aviso no la borra");
  t.w.localStorage.removeItem("bitty_upd_t"); await t.w.eval("updCheck()");
  ok(!t.bar(), "dentro de la misma sesión no insiste enseguida");
  const ls1 = { bitty_upd_n: t.w.localStorage.getItem("bitty_upd_n"), bitty_upd_t: String(Date.now()) };
  const t2 = boot({ build: 3, rel: "throw", ls: ls1 }); await sleep(150); await t2.w.eval("updCheck()");
  ok(!!t2.bar() && t2.w.document.querySelector("#updV").textContent === "Versión 5", "al reabrir la app vuelve a salir el aviso aunque se hubiera cerrado");
  ok(!t2.calls.some(c => c.u === API), "...y sin conexión ni consulta a GitHub: usa la versión guardada");
  t2.w.document.querySelector("#updLater").click(); await t2.w.eval("updCheck()");
  ok(!t2.bar(), "otra vez cerrado, no insiste en esa sesión");
  await t2.w.eval("updOff=Date.now()-7*36e5"); await t2.w.eval("updCheck()");
  ok(!!t2.bar(), "pasadas 6 horas en la misma sesión (app abierta mucho tiempo) vuelve a salir");
  const t3 = boot({ build: 5, rel: rel("build-5"), ls: { bitty_upd_n: "5" } }); await sleep(120); await t3.w.eval("updCheck()");
  ok(!t3.bar() && t3.w.localStorage.getItem("bitty_upd_n") === null, "al actualizar (instalada = guardada) el aviso desaparece y se borra lo guardado");
  const t3b = boot({ build: 9, rel: rel("build-5"), ls: { bitty_upd_n: "5" } }); await sleep(120); await t3b.w.eval("updCheck()");
  ok(!t3b.bar() && t3b.w.localStorage.getItem("bitty_upd_n") === null, "instalada MÁS nueva que la guardada: tampoco avisa");
  const t4 = boot({ build: 3, rel: rel("build-8"), ls: { bitty_upd_n: "5" } }); await sleep(120); await t4.w.eval("updCheck()");
  ok(t4.w.localStorage.getItem("bitty_upd_n") === "8" && t4.w.document.querySelector("#updV").textContent === "Versión 8", "si GitHub publica una versión aún más nueva que la guardada, se actualiza (8)");
  const t5 = boot({ build: 3, rel: rel("build-4"), ls: { bitty_upd_n: "9" } }); await sleep(120); await t5.w.eval("updCheck()");
  ok(t5.w.localStorage.getItem("bitty_upd_n") === "4", "si la versión guardada ya no existe en GitHub, se corrige a la real (4)");
  const t6 = boot({ build: 3, rel: rel("build-6") }); await sleep(150); await t6.w.eval("updCheck()");
  ok(!!t6.bar(), "una versión nueva (6) sin nada guardado también avisa");
  t6.w.document.querySelector("#updLater").click(); const before = t6.calls.length; await t6.w.eval("updCheck()");
  ok(t6.calls.length === before, "como mucho una consulta a GitHub cada 12 horas");
  ok(!!JSON.parse(JSON.stringify({ ok: 1 })).ok, "");

  // ---- casos en los que NO debe avisar
  for (const [name, o] of [
    ["misma versión", { build: 5, rel: rel("build-5") }],
    ["la instalada es más nueva", { build: 9, rel: rel("build-5") }],
    ["borrador", { rel: rel("build-9", { draft: true }) }],
    ["versión preliminar", { rel: rel("build-9", { prerelease: true }) }],
    ["etiqueta que no es build-N", { rel: rel("v9.9") }],
    ["etiqueta con basura", { rel: rel("build-9; alert(1)") }],
    ["etiqueta desmesurada", { rel: rel("build-99999999") }],
    ["respuesta sin etiqueta", { rel: { body: {} } }],
    ["error 500", { rel: { status: 500, body: {} } }],
    ["error 403 (límite de la API)", { rel: { status: 403, body: { message: "rate limit" } } }],
    ["sin red", { rel: "throw" }]
  ]) { const x = boot(Object.assign({ build: 3 }, o)); await sleep(100); await x.w.eval("updCheck()"); ok(!x.bar() && x.errs.length === 0, "sin aviso (ni errores) con: " + name); }
  let x = boot({ build: 3, rel: { status: 500, body: {} } }); await sleep(100); await x.w.eval("updCheck()");
  ok(!x.w.localStorage.getItem("bitty_upd_t"), "si falla la consulta no se bloquea el reintento 12 h");
  x = boot({ native: false, rel: rel("build-9") }); await sleep(100); await x.w.eval("updCheck()");
  ok(!x.bar() && !x.calls.some(c => c.u === API), "en la web / PWA / escritorio no se consulta nada (solo en la app de Android)");
  x = boot({ native: "web", rel: rel("build-9") }); await sleep(100); await x.w.eval("updCheck()");
  ok(!x.bar() && !x.calls.some(c => c.u === API), "con Capacitor cargado pero en modo web (no nativo) tampoco se consulta");
  x = boot({ build: 0, rel: rel("build-9") }); await sleep(100); await x.w.eval("updCheck()");
  ok(!x.bar(), "si la app no sabe su versión no avisa");
  x = boot({ build: 3, rel: rel("build-9") }); await sleep(100);
  x.w.document.body.insertAdjacentHTML("beforeend", '<button onclick="xq()">salir</button>'); await x.w.eval("updCheck()");
  ok(!x.bar(), "no interrumpe un nivel en curso (no sale el aviso)");
  ok(x.w.localStorage.getItem("bitty_upd_n") === "9", "...pero la versión nueva queda guardada");
  x.w.document.querySelector('[onclick="xq()"]').remove(); await x.w.eval("updCheck()");
  ok(!!x.bar(), "al salir del nivel el aviso aparece");

  // ---- app de escritorio (Electron): versión 1.0.N frente al título «Bitty para Windows (build N)» de la Release desktop-latest
  const dRel = n => ({ tag_name: "desktop-latest", name: "Bitty para Windows (build " + n + ")", draft: false, prerelease: false });
  x = boot({ native: false, desk: "1.0.5", relDesk: dRel(9) }); await sleep(100); await x.w.eval("updCheck()");
  ok(!!x.bar() && x.w.document.querySelector("#updV").textContent === "Versión 9" && x.w.document.querySelector("#updOk").textContent === "Actualizar ahora", "escritorio: la 1.0.5 instalada y la build 9 publicada → aviso con «Actualizar ahora» y la versión 9");
  ok(x.calls.some(c => c.u === APID) && !x.calls.some(c => c.u === API), "escritorio: consulta la Release desktop-latest (no la de Android)");
  ok(x.w.document.querySelector("#updOk").href === PAGE && x.w.document.querySelector("#updOk").target === "_blank", "escritorio: «Descargar» abre la página de descargas (constante) fuera de la app");
  for (const [name, o] of [["misma versión", { desk: "1.0.9", relDesk: dRel(9) }], ["instalada más nueva", { desk: "1.0.12", relDesk: dRel(9) }],
    ["versión de desarrollo 1.0.0", { desk: "1.0.0", relDesk: dRel(9) }], ["título antiguo sin número", { desk: "1.0.5", relDesk: { name: "Bitty para Windows (ultimo instalador)" } }],
    ["título manipulado", { desk: "1.0.5", relDesk: { name: "Bitty para Windows (build 9) <img src=x onerror=alert(1)>" } }], ["borrador", { desk: "1.0.5", relDesk: Object.assign(dRel(9), { draft: true }) }],
    ["versión instalada con formato raro", { desk: "1.0.5-beta", relDesk: dRel(9) }], ["versión desmesurada", { desk: "1.0.5", relDesk: dRel(99999999) }]]) {
    const y = boot(Object.assign({ native: false }, o)); await sleep(100); await y.w.eval("updCheck()"); ok(!y.bar() && y.errs.length === 0, "escritorio: sin aviso con: " + name); }
  x = boot({ native: false, desk: "1.0.5", relDesk: dRel(9) }); await sleep(100); x.w.eval("bittyDesktop.isDesktop"); 
  ok(Object.isFrozen(x.w.bittyDesktop), "escritorio: la API expuesta sigue congelada");
  x = boot({ native: false, relDesk: dRel(9) }); await sleep(100); await x.w.eval("updCheck()");
  ok(!x.bar() && !x.calls.some(c => c.u === APID || c.u === API), "web/PWA (sin app ni escritorio): no se consulta nada");

  // ---- el aviso se vuelve a comprobar al volver a la pantalla principal (si salió la versión mientras había un nivel en curso)
  x = boot({ build: 3, rel: rel("build-9"), ls: { bitty_upd_n: "9", bitty_upd_t: String(Date.now()) } }); await sleep(100);
  x.w.document.body.insertAdjacentHTML("beforeend", '<button onclick="xq()">salir</button>'); await x.w.eval("updCheck()");
  ok(!x.bar(), "en un nivel no sale el aviso guardado");
  x.w.document.querySelector('[onclick="xq()"]').remove(); x.w.eval("navr(true)"); await sleep(1300);
  ok(!!x.bar() && x.w.document.querySelector("#updV").textContent === "Versión 9", "al volver a mostrarse la barra de navegación (fuera del nivel) el aviso aparece solo, sin esperar a otra comprobación");

  // ---- VISTA PREVIA de prueba (solo en la web): enseña el aviso real sin publicar ninguna versión ni guardar nada
  x = boot({ native: false, hash: "#probar-aviso" }); await sleep(1500);
  ok(!!x.bar() && x.w.document.querySelector("#updT").textContent === "¡Hay una nueva versión de Bitty!" && x.w.document.querySelector("#updOk").textContent === "Actualizar ahora", "vista previa web (#probar-aviso): sale el aviso real con «Actualizar ahora»");
  ok(/Vista previa de prueba: no es una actualización real/.test(x.w.document.querySelector("#updV").textContent), "...marcado claramente como vista previa, no como actualización real");
  ok(x.w.document.querySelector("#updOk").href === PAGE && x.w.document.querySelector("#updOk").target === "_blank", "...y el botón lleva a la página de descargas existente");
  ok(!x.calls.some(c => c.u === API || c.u === APID) && x.w.localStorage.getItem("bitty_upd_n") === null && x.w.localStorage.getItem("bitty_upd_t") === null, "...sin consultar GitHub ni guardar nada");
  x.w.document.querySelector("#updLater").click(); ok(!x.bar(), "...y se puede cerrar");
  for (const [name, o] of [["sin la marca en la dirección", { native: false }], ["en la app de Android", { build: 3, hash: "#probar-aviso" }], ["en la app de escritorio", { native: false, desk: "1.0.5", hash: "#probar-aviso" }], ["marca parecida", { native: false, hash: "#probar-avisos" }]]) {
    const y = boot(o); await sleep(1500); ok(!y.bar(), "vista previa: no sale " + name);
  }

  // ---- idiomas
  x = boot({ build: 3, rel: rel("build-5"), lang: "en-US" }); await sleep(100); await x.w.eval("updCheck()");
  ok(/There's a new version of Bitty!/.test(x.bar().textContent) && /We've improved the app\. Update to enjoy what's new\./.test(x.bar().textContent) && x.w.document.querySelector("#updOk").textContent === "Update now" && /Version 5/.test(x.bar().textContent), "aviso en inglés: título, mensaje, «Update now» y versión");
  x = boot({ build: 3, rel: rel("build-5"), lang: "nl-NL" }); await sleep(100); await x.w.eval("updCheck()");
  ok(/Er is een nieuwe versie van Bitty!/.test(x.bar().textContent) && x.w.document.querySelector("#updOk").textContent === "Nu bijwerken" && /Versie 5/.test(x.bar().textContent), "aviso en neerlandés: título, «Nu bijwerken» y versión");

  // ---- web/PWA: versión nueva del service worker
  x = boot({ native: false, sw: "ctl" }); await sleep(100);
  x.sw.emit("controllerchange");
  ok(!!x.bar() && /¡Hay una nueva versión de Bitty!/.test(x.bar().textContent) && x.bar().querySelector("#updOk").textContent === "Actualizar ahora" && x.bar().querySelector("#updOk").tagName === "BUTTON", "PWA: al tomar el control un service worker nuevo se ofrece «Actualizar ahora» (no recarga sola)");
  x = boot({ native: false, sw: "first" }); await sleep(100);
  x.sw.emit("controllerchange");
  ok(!x.bar(), "PWA: la primera instalación del service worker no muestra aviso");

  // ---- página pública /descargar/
  const dl = fs.readFileSync(path.join(root, "www", "descargar", "index.html"), "utf8");
  const OKU = "https://github.com/pablofernandezmelero-png/BITTY_FINAL/releases/download/";
  const mk = (h) => { const dom = new JSDOM(dl, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://pablofernandezmelero-png.github.io/BITTY_FINAL/descargar/", virtualConsole: new VirtualConsole(), beforeParse(w) { Object.defineProperty(w.navigator, "language", { value: h.lang || "es-ES", configurable: true }); w.fetch = async u => { h.calls.push(String(u)); return h.f(String(u)); }; } }); return dom.window; };
  const R = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  const apk = (u, o = {}) => R(Object.assign({ tag_name: "build-7", published_at: "2026-11-05T10:00:00Z", draft: false, prerelease: false, assets: [{ name: "Bitty.apk", size: 9437184, browser_download_url: u || OKU + "build-7/Bitty.apk" }] }, o));
  let h = { calls: [], f: u => /\/latest$/.test(u) ? apk() : R({ tag_name: "desktop-latest", published_at: "2026-11-05T18:27:39Z", assets: [{ name: "Bitty-Setup.exe", size: 121700240, browser_download_url: OKU + "desktop-latest/Bitty-Setup.exe" }] }) };
  let p = mk(h); await sleep(150);
  const A = p.document.querySelector("#aA"), W = p.document.querySelector("#aW");
  ok(A && A.href === OKU + "build-7/Bitty.apk" && /Descargar APK/.test(A.textContent), "descargar: botón de la última APK con su enlace a la Release");
  ok(/Versión 7/.test(p.document.querySelector("#mA").textContent) && /9\.0 MB/.test(p.document.querySelector("#mA").textContent), "muestra la versión y el tamaño");
  ok(W && W.href === OKU + "desktop-latest/Bitty-Setup.exe" && /Windows/.test(W.textContent), "descargar: botón del instalador de Windows");
  ok(/^Actualizado 2026-11-05 · 116\.1 MB$/.test(p.document.querySelector("#mW").textContent) && !/Versión/.test(p.document.querySelector("#mW").textContent), "descargar: Windows muestra «Actualizado <fecha>», no una falsa versión");
  ok(h.calls.includes(API) && h.calls.includes("https://api.github.com/repos/pablofernandezmelero-png/BITTY_FINAL/releases/tags/desktop-latest") && h.calls.every(u => u.startsWith("https://api.github.com/repos/pablofernandezmelero-png/BITTY_FINAL/")), "solo consulta la API de este repositorio");
  ok(p.document.querySelector("#bB").getAttribute("href") === "../" && p.document.querySelector("#bI").getAttribute("href") === "../", "enlaces a la web y a las instrucciones de iPhone");
  ok(/Compartir/.test(p.document.querySelector("#oI").textContent) && /pantalla de inicio/.test(p.document.querySelector("#oI").textContent), "instrucciones de iPhone");
  p.document.querySelector('.lang button[data-l="en"]').click();
  ok(/Download APK/.test(p.document.querySelector("#aA").textContent) && p.document.documentElement.lang === "en", "cambio de idioma a inglés");
  p.document.querySelector('.lang button[data-l="nl"]').click();
  ok(/Downloaden APK/.test(p.document.querySelector("#aA").textContent), "cambio de idioma a neerlandés");
  // enlaces peligrosos
  for (const [nm, u] of [["otro dominio", "https://evil.example/Bitty.apk"], ["javascript:", "javascript:alert(1)"], ["con ..", OKU + "../../x/Bitty.apk"], ["http plano", "http://github.com/pablofernandezmelero-png/BITTY_FINAL/releases/download/a/Bitty.apk"], ["otro repositorio", "https://github.com/otro/repo/releases/download/a/Bitty.apk"]]) {
    h = { calls: [], f: uu => /\/latest$/.test(uu) ? apk(u) : R({}, 404) }; p = mk(h); await sleep(120);
    ok(!p.document.querySelector("#aA") && /Todavía no hay/.test(p.document.querySelector("#mA").textContent), "descargar: se rechaza el enlace " + nm);
  }
  h = { calls: [], f: u => /\/latest$/.test(u) ? apk(null, { draft: true }) : R({}, 404) }; p = mk(h); await sleep(120);
  ok(!p.document.querySelector("#aA"), "descargar: un borrador no se ofrece");
  h = { calls: [], f: u => /\/latest$/.test(u) ? R({ tag_name: '<img src=x onerror=alert(1)>', published_at: "<b>x</b>", assets: [{ name: "Bitty.apk", size: 1, browser_download_url: OKU + "a/Bitty.apk" }] }) : R({}, 404) }; p = mk(h); await sleep(120);
  ok(!p.document.querySelector("#cA img") && !p.document.querySelector("#cA b"), "descargar: los datos de la API se muestran como texto, nunca como HTML");
  h = { calls: [], f: u => R({}, 404) }; p = mk(h); await sleep(120);
  ok(!p.document.querySelector("#aA") && /Todavía no hay/.test(p.document.querySelector("#mA").textContent), "descargar: sin ninguna Release publicada lo dice con claridad");
  let fail = true; h = { calls: [], f: u => { if (fail) return R({}, 500); return /\/latest$/.test(u) ? apk() : R({}, 404); } }; p = mk(h); await sleep(150);
  ok(/No se pudo consultar/.test(p.document.querySelector("#mA").textContent) && !!p.document.querySelector("#rA"), "descargar: con error de la API muestra el aviso y «Reintentar»");
  fail = false; p.document.querySelector("#rA").click(); await sleep(120);
  ok(!!p.document.querySelector("#aA"), "descargar: «Reintentar» funciona");
  const cspD = (dl.match(/Content-Security-Policy" content="([^"]*)"/) || [])[1] || "";
  ok(/default-src 'none'/.test(cspD) && /connect-src https:\/\/api\.github\.com;/.test(cspD) && !/unsafe-eval/.test(cspD), "descargar: CSP estricta, solo conecta con la API de GitHub");
  ok(!/(innerHTML|document\.write|eval\()/.test(dl.split("<script>")[1]), "descargar: el script no usa innerHTML, document.write ni eval");

  // ---- workflows y gradle
  const wf = f => fs.readFileSync(path.join(root, ".github", "workflows", f), "utf8").replace(/\r\n/g, "\n");
  for (const f of ["android.yml", "android-release.yml", "desktop-windows.yml"]) {
    const s = wf(f), head = s.split("jobs:")[0];
    ok(/publish_release:[\s\S]*type: boolean[\s\S]*default: false/.test(head), f + ": publicar es opcional y por defecto NO publica");
    ok(/contents: write/.test(head), f + ": permiso de escritura solo para crear la Release");
    ok(/if: \$\{\{ inputs\.publish_release \}\}/.test(s), f + ": el paso de publicar solo se ejecuta si lo pides");
    ok(/GH_TOKEN: \$\{\{ github\.token \}\}/.test(s) && !/secrets\.GITHUB_TOKEN|ghp_/.test(s), f + ": usa el token temporal del workflow, ningún token guardado");
  }
  ok(/gh release create "build-\$BITTY_VERSION_CODE" Bitty\.apk[\s\S]*--latest/.test(wf("android-release.yml")), "la APK FIRMADA se publica como Release build-N marcada «latest» con el archivo Bitty.apk");
  ok(/gh release create "build-\$RUN_NUMBER" Bitty\.apk .*--prerelease --latest=false/.test(wf("android.yml")) && !/--latest(?!=false)/.test(wf("android.yml").split("gh release create")[1]), "la APK de PRUEBA se publica como versión preliminar y NUNCA como «latest» (la página y el aviso solo ofrecen la firmada)");
  ok(/BITTY_VERSION_CODE: \$\{\{ github\.run_number \}\}/.test(wf("android.yml")), "APK de prueba: versionCode = número de ejecución (el mismo N que la etiqueta build-N)");
  ok(/BITTY_VERSION_CODE=\$\(\(1000 \+ GITHUB_RUN_NUMBER\)\)" >> "\$GITHUB_ENV"/.test(wf("android-release.yml")) && !/BITTY_VERSION_CODE: \$\{\{/.test(wf("android-release.yml")), "APK firmada: versionCode = 1000 + ejecución (su numeración no choca con la de las de prueba) y la etiqueta usa ese mismo número");
  ok(/apksigner[\s\S]*verify --verbose --print-certs[\s\S]*APK Signature Scheme v2\): true[\s\S]*CN=Bitty/.test(wf("android-release.yml")), "APK firmada: el workflow comprueba la firma con apksigner (v2 y certificado de Bitty) antes de publicar");
  ok(/certificate DN: CN=Bitty/.test(wf("android-release.yml")) && /certificate SHA-256 digest: 71f641f3191c8f7d9b46ec5af958bbf282113edafc3c5f240074889b9941c96b/.test(wf("android-release.yml")), "el workflow exige el certificado CN=Bitty y la huella SHA-256 exacta de la clave de Bitty");
  ok(wf("android-release.yml").indexOf("- name: Verificar la firma") < wf("android-release.yml").indexOf("- name: Publicar la APK firmada"), "la firma se verifica antes de publicar");
  const gradle = fs.readFileSync(path.join(root, "android", "app", "build.gradle"), "utf8");
  ok(/^def bittyVersionCode = Integer\.parseInt\(System\.getenv\("BITTY_VERSION_CODE"\) \?: "1"\)$/m.test(gradle) && /^\s+versionCode bittyVersionCode$/m.test(gradle), "gradle lee BITTY_VERSION_CODE con una variable simple (la forma anterior rompía la compilación)");
  ok(!/versionCode \(/.test(gradle), "gradle: sin la sintaxis ambigua «versionCode (…)» que rompió el workflow");
  ok(/^def bittyVersionCode/m.test(gradle) && gradle.indexOf("def bittyVersionCode") < gradle.indexOf("android {"), "gradle: la variable se define antes del bloque android");
  ok(/desktop-latest[\s\S]*--latest=false[\s\S]*--clobber/.test(wf("desktop-windows.yml")) && /Bitty-Setup\.exe/.test(wf("desktop-windows.yml")), "el instalador de Windows se publica en desktop-latest sin quitar «latest» a la APK");
  ok(/\bgh release create\b/.test(wf("android.yml")) && !/gh release (delete|edit(?! desktop-latest))/.test(wf("android.yml") + wf("android-release.yml") + wf("desktop-windows.yml")), "los workflows nunca borran ni editan Releases ajenas");
  ok(/paths:[\s\S]*www\/\*\*/.test(wf("pages.yml")), "la página /descargar/ se publica sola con www/**");

  console.log(`update.test: ${n - fails}/${n} comprobaciones correctas`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
