// Aviso de actualización de la app (APK nueva / versión web nueva), página pública /descargar/ y workflows de publicación.
// La app y la página se ejecutan en jsdom con fetch y Capacitor simulados. No sustituye a probar una actualización real.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGE = "https://pablofernandezmelero-png.github.io/BITTY_FINAL/descargar/";
const API = "https://api.github.com/repos/pablofernandezmelero-png/BITTY_FINAL/releases/latest";
const appHtml = fs.readFileSync(path.join(root, "www", "index.html"), "utf8")
  .replace(/const SB={[^}]*};/, 'const SB={url:"https://abc.supabase.co",key:"k".repeat(30)};').replace(/<link[^>]*fonts.googleapis[^>]*>/g, "");

function boot(o) {
  const calls = [], errs = [], vc = new VirtualConsole();
  vc.on("jsdomError", e => errs.push(String(e.message)));
  const sw = o.sw ? Object.assign(new (require("events").EventEmitter)(), { controller: o.sw === "ctl" ? {} : null }) : null;
  const dom = new JSDOM(appHtml, {
    runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "http://localhost/",
    beforeParse(w) {
      w.Element.prototype.scrollIntoView = () => {};
      Object.defineProperty(w.navigator, "language", { value: o.lang || "es-ES", configurable: true });
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
      w.fetch = async (u, init) => { calls.push({ u: String(u), init }); if (String(u) === API && o.rel) { if (o.rel === "throw") throw new TypeError("net"); const r = typeof o.rel === "function" ? o.rel() : o.rel; return { ok: r.status ? r.status < 400 : true, status: r.status || 200, json: async () => r.body !== undefined ? r.body : r }; } return { ok: false, status: 404, json: async () => ({}) }; };
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
  ok(/versión nueva de Bitty/.test(t.bar().textContent) && /Descargar/.test(t.bar().textContent) && /Más tarde/.test(t.bar().textContent), "el aviso está en español con «Descargar» y «Más tarde»");
  const a = t.w.document.querySelector("#updOk");
  ok(a && a.tagName === "A" && a.href === PAGE && a.target === "_blank" && /noopener/.test(a.rel), "«Descargar» lleva a la página pública /descargar/ (constante), en pestaña nueva y con noopener");
  ok(!t.w.document.body.innerHTML.includes("evil.example"), "nada de lo que devuelve la API decide el destino del enlace");
  const f = t.calls.find(c => c.u === API);
  ok(f && f.init.credentials === "omit" && f.init.referrerPolicy === "no-referrer", "la consulta va sin cookies ni referer");
  ok(t.calls.filter(c => c.u === API).length === 1, "una sola consulta");
  ok(t.w.document.querySelector("#upd").getAttribute("role") === "status", "accesible: role=status");
  // «Más tarde»: se recuerda esa versión
  t.w.document.querySelector("#updLater").click();
  ok(!t.bar() && t.w.localStorage.getItem("bitty_upd_skip") === "5", "«Más tarde» cierra el aviso y recuerda la versión 5");
  t.w.localStorage.removeItem("bitty_upd_t"); await t.w.eval("updCheck()");
  ok(!t.bar(), "no vuelve a molestar por la misma versión");
  // una aún más nueva sí avisa
  const t2 = boot({ build: 3, rel: rel("build-6"), ls: { bitty_upd_skip: "5" } }); await sleep(150); await t2.w.eval("updCheck()");
  ok(!!t2.bar(), "pero una versión posterior (6) sí vuelve a avisar");
  // límite de frecuencia
  t2.w.document.querySelector("#updLater").click(); const before = t2.calls.length; await t2.w.eval("updCheck()");
  ok(t2.calls.length === before, "como mucho una consulta cada 12 horas");

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
  ok(!x.bar() && !x.calls.some(c => c.u === API), "no interrumpe un nivel en curso");

  // ---- idiomas
  x = boot({ build: 3, rel: rel("build-5"), lang: "en-US" }); await sleep(100); await x.w.eval("updCheck()");
  ok(/new version of Bitty/.test(x.bar().textContent) && /Download/.test(x.bar().textContent), "aviso en inglés");
  x = boot({ build: 3, rel: rel("build-5"), lang: "nl-NL" }); await sleep(100); await x.w.eval("updCheck()");
  ok(/nieuwe versie van Bitty/.test(x.bar().textContent) && /Downloaden/.test(x.bar().textContent), "aviso en neerlandés");

  // ---- web/PWA: versión nueva del service worker
  x = boot({ native: false, sw: "ctl" }); await sleep(100);
  x.sw.emit("controllerchange");
  ok(!!x.bar() && /Actualizar/.test(x.bar().textContent) && x.bar().querySelector("#updOk").tagName === "BUTTON", "PWA: al tomar el control un service worker nuevo se ofrece «Actualizar» (no recarga sola)");
  x = boot({ native: false, sw: "first" }); await sleep(100);
  x.sw.emit("controllerchange");
  ok(!x.bar(), "PWA: la primera instalación del service worker no muestra aviso");

  // ---- página pública /descargar/
  const dl = fs.readFileSync(path.join(root, "www", "descargar", "index.html"), "utf8");
  const OKU = "https://github.com/pablofernandezmelero-png/BITTY_FINAL/releases/download/";
  const mk = (h) => { const dom = new JSDOM(dl, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://pablofernandezmelero-png.github.io/BITTY_FINAL/descargar/", virtualConsole: new VirtualConsole(), beforeParse(w) { Object.defineProperty(w.navigator, "language", { value: h.lang || "es-ES", configurable: true }); w.fetch = async u => { h.calls.push(String(u)); return h.f(String(u)); }; } }); return dom.window; };
  const R = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  const apk = (u, o = {}) => R(Object.assign({ tag_name: "build-7", published_at: "2026-11-05T10:00:00Z", draft: false, prerelease: false, assets: [{ name: "Bitty.apk", size: 9437184, browser_download_url: u || OKU + "build-7/Bitty.apk" }] }, o));
  let h = { calls: [], f: u => /\/latest$/.test(u) ? apk() : R({ tag_name: "desktop-latest", assets: [{ name: "Bitty-Setup.exe", size: 121700240, browser_download_url: OKU + "desktop-latest/Bitty-Setup.exe" }] }) };
  let p = mk(h); await sleep(150);
  const A = p.document.querySelector("#aA"), W = p.document.querySelector("#aW");
  ok(A && A.href === OKU + "build-7/Bitty.apk" && /Descargar APK/.test(A.textContent), "descargar: botón de la última APK con su enlace a la Release");
  ok(/Versión 7/.test(p.document.querySelector("#mA").textContent) && /9\.0 MB/.test(p.document.querySelector("#mA").textContent), "muestra la versión y el tamaño");
  ok(W && W.href === OKU + "desktop-latest/Bitty-Setup.exe" && /Windows/.test(W.textContent), "descargar: botón del instalador de Windows");
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
  ok(/gh release create "build-\$RUN_NUMBER" Bitty\.apk[\s\S]*--latest/.test(wf("android.yml")) && /gh release create "build-\$BITTY_VERSION_CODE" Bitty\.apk[\s\S]*--latest/.test(wf("android-release.yml")), "las APK se publican como Release build-N marcada «latest» con el archivo Bitty.apk");
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
  ok(/\bgh release create\b/.test(wf("android.yml")) && !/gh release (delete|edit)/.test(wf("android.yml") + wf("android-release.yml") + wf("desktop-windows.yml")), "los workflows nunca borran ni editan Releases ajenas");
  ok(/paths:[\s\S]*www\/\*\*/.test(wf("pages.yml")), "la página /descargar/ se publica sola con www/**");

  console.log(`update.test: ${n - fails}/${n} comprobaciones correctas`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
