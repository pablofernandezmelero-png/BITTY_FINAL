// PWA / iPhone: manifiesto, iconos (dimensiones reales), etiquetas iOS, CSP y comportamiento del service worker
// (ejecutado en un contexto aislado con caches/fetch simulados: sin conexión, actualización, otros orígenes, tokens).
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const R = (...p) => path.join(root, ...p);
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };

const html = fs.readFileSync(R("www", "index.html"), "utf8");
const head = html.slice(0, html.indexOf("</head>"));
const mf = JSON.parse(fs.readFileSync(R("www", "manifest.webmanifest"), "utf8"));

// ---- PNG: dimensiones leídas de la cabecera IHDR
const png = f => { const b = fs.readFileSync(f); return b.slice(1, 4).toString() === "PNG" ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20), ct: b[25] } : null; };

// ---- manifiesto
ok(mf.display === "standalone", "display standalone (sin barra de Safari)");
ok(mf.start_url === "./" && mf.scope === "./" && mf.id === "./", "start_url/scope/id relativos (funciona en /BITTY_FINAL/ y en la raíz)");
ok(/^#[0-9a-f]{6}$/i.test(mf.theme_color) && /^#[0-9a-f]{6}$/i.test(mf.background_color), "colores del tema válidos");
ok(mf.name === "Bitty" && mf.short_name === "Bitty", "nombre");
const need = [["any", 192], ["any", 512], ["maskable", 192], ["maskable", 512]];
for (const [purpose, size] of need) {
  const ic = (mf.icons || []).find(i => i.purpose === purpose && i.sizes === size + "x" + size);
  ok(!!ic, `icono ${purpose} ${size}x${size} declarado`);
  if (!ic) continue;
  ok(fs.existsSync(R("www", ic.src)), `el archivo ${ic.src} existe`);
  const p = fs.existsSync(R("www", ic.src)) && png(R("www", ic.src));
  ok(p && p.w === size && p.h === size, `${ic.src} mide realmente ${size}x${size}`);
}
// iPhone no admite transparencia en el icono de pantalla de inicio (la rellena de negro): debe ser RGB sin alfa o con alfa opaco
const at = png(R("www", "icons", "apple-touch-icon.png"));
ok(at && at.w === 180 && at.h === 180, "apple-touch-icon mide 180x180");
const fav = png(R("www", "icons", "favicon-32.png"));
ok(fav && fav.w === 32 && fav.h === 32, "favicon 32x32");
const pl = png(R("store", "play-icon-512.png"));
ok(pl && pl.w === 512 && pl.h === 512, "icono de Google Play 512x512");

// ---- etiquetas del HTML
ok(/<link rel="manifest" href="manifest\.webmanifest">/.test(head), "enlace al manifiesto");
ok(/<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/.test(head), "apple-touch-icon enlazado");
ok(/name="apple-mobile-web-app-capable" content="yes"/.test(head), "iOS: modo aplicación a pantalla completa");
ok(/name="apple-mobile-web-app-title" content="Bitty"/.test(head), "iOS: título bajo el icono");
ok(/name="apple-mobile-web-app-status-bar-style"/.test(head), "iOS: estilo de la barra de estado");
ok(/viewport-fit=cover/.test(head), "viewport-fit=cover (zona segura del iPhone con muesca)");
const csp = (head.match(/Content-Security-Policy" content="([^"]*)"/) || [])[1] || "";
const dir = n => (csp.split(";").map(s => s.trim()).find(s => s.startsWith(n + " ")) || "");
ok(/'self'/.test(dir("manifest-src")) && /'self'/.test(dir("worker-src")) && /'self'/.test(dir("img-src")), "CSP: manifest-src, worker-src e img-src permiten solo 'self'");
ok(!/\*/.test(dir("worker-src")) && !/http/.test(dir("worker-src")) && !/http/.test(dir("manifest-src")), "CSP: el service worker y el manifiesto solo del mismo origen");
ok(/default-src 'none'/.test(csp) && !/unsafe-eval/.test(csp), "CSP sigue siendo estricta");
ok(/connect-src https:\/\/\*\.supabase\.co/.test(csp), "CSP: solo se conecta a Supabase");

// ---- registro del service worker: solo en la web, nunca en Capacitor ni en Electron
const reg = (html.match(/try\{if\("serviceWorker"in navigator[^\n]*/) || [""])[0];
ok(!!reg, "el registro del service worker existe");
ok(/!window\.Capacitor/.test(reg) && /!window\.bittyDesktop/.test(reg), "no se registra en la app de Android ni en la de escritorio");
ok(/location\.protocol==="https:"/.test(reg), "solo se registra por https (o localhost)");
ok(/register\("sw\.js"\)/.test(reg), "registra sw.js con ruta relativa");

// ---- el service worker, ejecutado de verdad en un contexto aislado
const swSrc = fs.readFileSync(R("www", "sw.js"), "utf8");
function mkEnv(origin) {
  const store = {}; // nombreCaché -> Map(url -> Response-like)
  const listeners = {};
  let online = true; const netHits = []; let net = new Map();
  const key = r => (typeof r === "string" ? new URL(r, origin + "/app/").href : r.url);
  const mkRes = (body, o = {}) => ({ ok: o.ok !== false, status: o.status || 200, type: o.type || "basic", body, clone() { return mkRes(body, o); }, headers: o.headers || {} });
  const caches = {
    async open(n) { store[n] = store[n] || new Map(); const m = store[n]; return { addAll: async us => { for (const u of us) m.set(key(u), mkRes("pre:" + u)); }, put: async (r, res) => { m.set(key(r), res); } }; },
    async keys() { return Object.keys(store); },
    async delete(n) { delete store[n]; return true; },
    async match(r, opt) { const k = key(r); const base = k.split("?")[0]; for (const m of Object.values(store)) { if (m.has(k)) return m.get(k); if (opt && opt.ignoreSearch) for (const [kk, v] of m) if (kk.split("?")[0] === base) return v; } return undefined; }
  };
  const self = { location: new URL(origin + "/app/sw.js"), skipWaiting: async () => { self.skipped = true; }, clients: { claim: async () => { self.claimed = true; } }, addEventListener: (t, f) => { listeners[t] = f; } };
  const ctx = vm.createContext({ self, caches, URL, Promise, Response: function (b, o) { return mkRes(b, { status: o && o.status, ok: false }); }, fetch: async r => { netHits.push(r.url); if (!online) throw new TypeError("offline"); const v = net.get(r.url); return v ? v() : mkRes("net:" + r.url); } });
  vm.runInContext(swSrc, ctx);
  const wait = async f => { let p; f({ waitUntil: x => { p = x; } }); await p; };
  const fetchEv = async (url, o = {}) => { let rp; const req = { url: origin + url, method: o.method || "GET", mode: o.mode || "cors" }; listeners.fetch({ request: req, respondWith: p => { rp = p; } }); return rp === undefined ? "PASS" : await rp; };
  return { self, listeners, store, netHits, setOnline: v => { online = v; }, net, install: () => wait(listeners.install), activate: () => wait(listeners.activate), fetchEv, mkRes };
}

(async () => {
  const O = "https://x.github.io";
  const e = mkEnv(O);
  await e.install();
  const pre = Object.keys(e.store)[0];
  ok(/^bitty-v\d+$/.test(pre || ""), "la caché tiene nombre versionado");
  ok(e.self.skipped === true, "install: skipWaiting (la versión nueva se aplica enseguida)");
  const PRE = [...swSrc.matchAll(/PRECACHE = \[([^\]]*)\]/g)][0][1].match(/"[^"]+"/g).map(s => s.slice(1, -1));
  ok(PRE.every(p => fs.existsSync(R("www", p === "./" ? "index.html" : p))), "todo lo precacheado existe en www/");
  ok(PRE.includes("./index.html") && PRE.includes("./manifest.webmanifest"), "se precachea la app y el manifiesto");
  await e.store[pre].set("https://x.github.io/app/old", e.mkRes("x"));
  await e.activate();
  ok(e.self.claimed === true, "activate: clients.claim");

  // otros orígenes (Supabase, fuentes): ni se interceptan ni se guardan
  const cross = { url: "https://tewlouwqlpjmrifvhrhz.supabase.co/auth/v1/token", method: "GET", mode: "cors" };
  let handled = false; e.listeners.fetch({ request: cross, respondWith: () => { handled = true; } });
  ok(!handled, "las peticiones a Supabase NO pasan por el service worker");
  const fonts = { url: "https://fonts.gstatic.com/x.woff2", method: "GET", mode: "cors" };
  handled = false; e.listeners.fetch({ request: fonts, respondWith: () => { handled = true; } });
  ok(!handled, "las fuentes de otro origen tampoco");
  const post = { url: O + "/app/x", method: "POST", mode: "cors" };
  handled = false; e.listeners.fetch({ request: post, respondWith: () => { handled = true; } });
  ok(!handled, "las peticiones que no son GET no se interceptan");

  // con conexión: respuesta de la red y copia actualizada
  let r = await e.fetchEv("/app/index.html", { mode: "navigate" });
  ok(r.body === "net:" + O + "/app/index.html", "con conexión se sirve la versión de la red (red primero)");
  ok(e.store[pre].get(O + "/app/index.html").body === "net:" + O + "/app/index.html", "y se actualiza la copia guardada");

  // sin conexión
  e.setOnline(false);
  r = await e.fetchEv("/app/index.html", { mode: "navigate" });
  ok(r.body === "net:" + O + "/app/index.html", "sin conexión se abre la última versión guardada");
  r = await e.fetchEv("/app/icons/icon-192.png");
  ok(r.body === "pre:./icons/icon-192.png", "sin conexión funcionan los iconos precacheados");
  r = await e.fetchEv("/app/otra-ruta", { mode: "navigate" });
  ok(r.body === "net:" + O + "/app/index.html", "navegar sin conexión a una ruta desconocida abre la app");
  r = await e.fetchEv("/app/auth/confirm/?token_hash=abc", { mode: "navigate" });
  ok(r.status === 503, "sin conexión, la página de confirmación NO se sustituye por la app (devuelve 503)");
  r = await e.fetchEv("/app/dato-que-no-existe.json");
  ok(r.status === 503, "recurso desconocido sin conexión: 503 claro, sin colgarse");

  // tokens: nunca se guardan
  e.setOnline(true);
  for (const u of ["/app/auth/confirm/?token_hash=SECRETO123456789&type=email", "/app/x?access_token=SECRETO", "/app/x?code=SECRETO", "/app/x?token=SECRETO", "/app/x?refresh_token=SECRETO"]) {
    await e.fetchEv(u, { mode: "navigate" });
    ok(![...e.store[pre].keys()].some(k => /SECRETO/.test(k)), "no se guarda en caché la URL con credenciales: " + u.split("?")[1].split("=")[0]);
  }
  // respuestas de error o de otro tipo no se guardan
  e.net.set(O + "/app/roto", () => e.mkRes("err", { ok: false, status: 500 }));
  await e.fetchEv("/app/roto");
  ok(!e.store[pre].has(O + "/app/roto"), "una respuesta de error del servidor no se guarda");
  e.net.set(O + "/app/opaca", () => e.mkRes("op", { type: "opaque" }));
  await e.fetchEv("/app/opaca");
  ok(!e.store[pre].has(O + "/app/opaca"), "una respuesta opaca no se guarda");

  // actualización: una caché antigua se borra al activar
  const e2 = mkEnv(O); await e2.install(); e2.store["bitty-v0"] = new Map([["x", 1]]); await e2.activate();
  ok(!e2.store["bitty-v0"] && !!e2.store[Object.keys(e2.store)[0]], "al activar se borran las cachés de versiones antiguas");

  // el service worker no usa nada peligroso
  ok(!/eval\(|new Function|importScripts|XMLHttpRequest/.test(swSrc), "sw.js sin eval, importScripts ni XHR");

  console.log(`pwa.test: ${n - fails}/${n} comprobaciones correctas`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
