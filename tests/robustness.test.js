// Robustez ante escenarios extremos (jsdom + servidor simulado): almacenamiento corrupto, ausente o lleno,
// datos antiguos, contenido hostil guardado, sesión caducada, servidor caído o intermitente, y cierre
// inesperado con eventos de XP pendientes. NO sustituye a probarlo en un móvil ni contra Supabase real.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const HTML = fs.readFileSync(process.argv[2] || "www/index.html", "utf8")
  .replace(/const SB={[^}]*};/, 'const SB={url:"https://abc.supabase.co",key:"k".repeat(30)};')
  .replace(/<link[^>]*fonts.googleapis[^>]*>/g, "");
const sleep = ms => new Promise(r => setTimeout(r, ms));
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };
const FUT = () => Date.now() + 3.6e6;
const AUTH = () => JSON.stringify({ a: "T", r: "R", e: FUT(), id: "u1", m: "a@b.com" });

function server() {
  const st = { mode: "ok", refresh: "ok", xp: 0, calls: [] };
  st.fetch = async (url, o = {}) => {
    const u = new URL(url), body = o.body ? JSON.parse(o.body) : null, method = o.method || "GET";
    st.calls.push({ path: u.pathname, method, body });
    const R = (s, j) => ({ ok: s < 300, status: s, json: async () => j });
    if (st.mode === "netfail") throw new TypeError("Failed to fetch");
    if (st.mode === "500") return R(500, { message: "boom" });
    if (u.pathname === "/auth/v1/token") return st.refresh === "bad" ? R(400, { error_description: "Invalid Refresh Token: <u>hostil</u>" }) : R(200, { access_token: "T2", refresh_token: "R2", expires_in: 3600, user: { id: "u1", email: "a@b.com" } });
    if (u.pathname === "/auth/v1/user") return R(200, { id: "u1", email: "a@b.com", factors: [] });
    if (u.pathname === "/rest/v1/progress") return method === "GET" ? R(200, []) : R(201, null);
    if (u.pathname === "/rest/v1/profiles") return R(201, null);
    if (u.pathname === "/rest/v1/stats") return R(200, [{ xp: st.xp }]);
    if (u.pathname === "/rest/v1/rpc/import_legacy_stats") return R(200, {});
    if (u.pathname === "/rest/v1/rpc/award_xp") { st.xp += body.p_xp; return R(200, { awarded: body.p_xp, duplicate: false, xp: st.xp, streak: 1 }); }
    return R(404, { message: "x" });
  };
  st.awards = () => st.calls.filter(c => c.path === "/rest/v1/rpc/award_xp");
  return st;
}

// store: {clave: valor} para prefijar localStorage · wrap(w, real): sustituye localStorage por una versión hostil
async function boot({ store = {}, srv = server(), wrap = null, ms = 700, hash = "", confirmFn = null } = {}) {
  const errs = [], vc = new VirtualConsole();
  vc.on("jsdomError", e => errs.push("JSDOM: " + (e.detail && e.detail.stack || e.message)));
  vc.on("error", (...a) => errs.push("console.error: " + a.join(" ")));
  const dom = new JSDOM(HTML, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "http://localhost/" + hash,
    beforeParse(w) {
      if (confirmFn) w.confirm = confirmFn;
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
      w.Element.prototype.scrollIntoView = () => {};
      Object.defineProperty(w.navigator,"language",{value:"es-ES",configurable:true});
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {} }));
      for (const k in store) w.localStorage.setItem(k, store[k]);
      w.fetch = srv.fetch;
      w.addEventListener("unhandledrejection", e => errs.push("promesa sin capturar: " + (e.reason && e.reason.message)));
      if (wrap) wrap(w, w.localStorage);
    } });
  const w = dom.window;
  w.addEventListener("error", e => errs.push("window error: " + e.message));
  await sleep(ms);
  return { w, errs, srv, ev: s => w.eval(s), T: () => (()=>{const a=w.document.querySelector("#app");return (a?a.textContent:"")+" "+[...w.document.querySelectorAll("#tst,#offb")].map(e=>e.textContent).join(" ")})(), ls: k => { try { return w.localStorage.getItem(k); } catch (e) { return null; } } };
}
const GOOD = (o = {}) => JSON.stringify(Object.assign({ v: 2, name: "Ana", track: "g", dif: 1, done: { "g:1": 3 }, xp: 120, streak: 2, last: "2026-11-04", sp: [], hist: ["a", "b"], hd: {}, ch: {}, cn: {}, lang: "es" }, o));

(async () => {
  let b;
  // 1) estado corrupto
  b = await boot({ store: { bitty: "{esto no es json" } });
  ok(b.errs.length === 0 && (!!b.w.document.querySelector("#cE") || !!b.w.document.querySelector("#nmI")) && b.ev("S.xp") === 0, "JSON corrupto en el estado: arranca sin errores, con estado vacío y pantalla de entrada. errores: " + b.errs.slice(0, 2));
  // 2) tipos equivocados
  b = await boot({ store: { bitty: '{"name":123,"xp":"abc","hist":"x","done":[],"streak":-5,"last":"hoy","dif":99,"track":"zzz","sp":"no","hd":7}' } });
  const sx = JSON.parse(b.ev("JSON.stringify(S)"));
  ok(b.errs.length === 0 && typeof sx.xp === "number" && sx.xp >= 0 && sx.streak >= 0 && [0, 1, 2].includes(sx.dif) && Array.isArray(sx.hist) && Array.isArray(sx.sp), "tipos equivocados: se sanean sin errores. S=" + JSON.stringify(sx).slice(0, 120) + " errores: " + b.errs.slice(0, 2));
  // 3) claves auxiliares corruptas
  b = await boot({ store: { bitty: GOOD(), bitty_xq: '"nope"', bitty_auth: "basura", bitty_ads: "{[", bitty_owner: "{" } });
  ok(b.errs.length === 0 && b.ev("AU") === null && b.ev("xev().length") === 0 && b.ev("adSt().n") === 0, "claves auxiliares corruptas (cola, sesión, anuncios): se ignoran sin errores");
  // 4) almacenamiento no disponible (modo privado / bloqueado)
  b = await boot({ wrap: w => { Object.defineProperty(w, "localStorage", { value: { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } } }); } });
  ok(b.errs.length === 0 && !!b.w.document.querySelector("#nmI"), "sin almacenamiento: la app arranca y funciona en memoria. errores: " + b.errs.slice(0, 2));
  b.ev("S.name='Ana';save();pick('g')");
  ok(b.errs.length === 0 && b.ev("S.track") === "g", "sin almacenamiento: se puede elegir ruta y guardar sin romper");
  // 5) cuota de almacenamiento llena: se recorta el historial antiguo y NO se pierde el progreso
  b = await boot({ store: { bitty: GOOD({ xp: 4321 }) }, wrap: (w, real) => { Object.defineProperty(w, "localStorage", { value: { getItem: k => real.getItem(k), removeItem: k => real.removeItem(k), setItem: (k, v) => { if (v.length > 1.2e6) throw new w.DOMException("quota", "QuotaExceededError"); real.setItem(k, v); } } }); } });
  b.ev(`S.hist=Array.from({length:40000},(_,i)=>"pregunta de relleno número "+i+" "+"x".repeat(50));HSs.clear();S.hist.forEach(k=>HSs.add(k));HIm=null;S.hd={"g:1":S.hist.slice()};S.xp=4999;save()`);
  const stored = b.ls("bitty"), ps = stored && JSON.parse(stored);
  ok(stored && stored.length <= 1.2e6 && ps.xp === 4999 && ps.name === "Ana" && ps.hist.length >= 200 && ps.hist.length < 40000, `cuota llena: el estado se guarda recortando el historial (guardado ${(stored || "").length} caracteres, historial ${ps && ps.hist.length}, xp ${ps && ps.xp})`);
  ok(b.ev("HSs.size") === ps.hist.length, "el índice anti-repetición queda coherente con el historial recortado");
  // 6) datos de una versión antigua
  b = await boot({ store: { bitty: '{"name":"Ana","xp":120,"track":"g","done":{"g":3}}', bitty_guest: "1" } });
  ok(b.errs.length === 0 && b.ev("S.xp") === 120 && /Ana/.test(b.T()), "estado de formato antiguo: se conserva el XP y se muestra la app");
  // 7) contenido hostil guardado o devuelto por el servidor se muestra como texto
  b = await boot({ store: { bitty: GOOD({ name: "<u>zz</u>" }), bitty_guest: "1" } });
  ok(b.errs.length === 0 && b.w.document.querySelectorAll("u").length === 0 && !/[<>]/.test(b.ev("S.name")), "nombre guardado con HTML: se sanea al cargar (sin < ni >) y no crea elementos: " + b.ev("S.name"));
  const srvBad = server(); srvBad.refresh = "bad";
  b = await boot({ srv: srvBad, store: { bitty: GOOD(), bitty_auth: JSON.stringify({ a: "x", r: "old", e: Date.now() - 1000, id: "u1", m: "<u>m</u>@x.com" }) } });
  // 8) sesión caducada y no renovable
  ok(b.errs.length === 0 && b.ev("AU") === null && b.ls("bitty_auth") === null && b.ev("S.xp") === 120, "sesión caducada sin renovación: se cierra, se borra el token y se conserva el progreso local");
  ok(/Ana/.test(b.T()) || !!b.w.document.querySelector("nav"), "…y la app sigue usable (modo local)");
  b.ev("tab='p';home()"); await sleep(100);
  ok(!!b.w.document.querySelector("#cE") && b.w.document.querySelectorAll("#app u, main u").length === 0, "…ofrece iniciar sesión de nuevo en el Perfil, sin HTML inyectado");
  // 9) servidor caído (500) e intermitente (sin red): la cola de XP se conserva y no hay duplicados al recuperarse
  const s9 = server();
  b = await boot({ srv: s9, store: { bitty: GOOD(), bitty_auth: AUTH() } });
  b.ev(`S.last="${new Date().toISOString().slice(0, 10)}";S.track="g";xevPush({kind:"level",ref:"lv:g:1:3",xp:10,day:S.last})`);
  const id9 = JSON.parse(b.ls("bitty_xq"))[0].id;
  s9.mode = "500"; s9.calls = [];
  ok((await b.ev("cpush()")) === false && JSON.parse(b.ls("bitty_xq")).length === 1, "servidor 500: la subida falla y el evento de XP se conserva en la cola");
  s9.mode = "netfail"; s9.calls = [];
  ok((await b.ev("cpush()")) === false && JSON.parse(b.ls("bitty_xq")).length === 1 && b.errs.length === 0, "sin red (fallo de conexión): falla sin errores sin capturar y el evento se conserva");
  s9.mode = "ok"; s9.calls = [];
  ok((await b.ev("cpush()")) === true, "al volver la conexión la subida funciona");
  await sleep(150);
  ok(JSON.parse(b.ls("bitty_xq")).length === 0 && s9.awards().length === 1 && s9.awards()[0].body.p_event_id === id9, "…y el evento se envía UNA sola vez con su mismo identificador (no se duplica)");
  // 10) cierre inesperado: lo pendiente sobrevive al reinicio y se envía después
  const s10a = server();
  b = await boot({ srv: s10a, store: { bitty: GOOD(), bitty_auth: AUTH() } });
  b.ev(`S.last="${new Date().toISOString().slice(0, 10)}";xevPush({kind:"boss",ref:"lv:g:1:9",xp:40,day:S.last});S.xp+=40;save()`);
  s10a.mode = "netfail";
  const snap = { bitty: b.ls("bitty"), bitty_auth: b.ls("bitty_auth"), bitty_xq: b.ls("bitty_xq") };
  const id10 = JSON.parse(snap.bitty_xq)[0].id;
  b.w.close();
  const s10b = server(); s10b.xp = 120;   // el servidor ya tenía los 120 XP anteriores
  const b2 = await boot({ srv: s10b, store: snap, ms: 900 });
  ok(b2.ev("S.xp") === 160 && b2.errs.length === 0, "reinicio tras cierre inesperado: el progreso se conserva (120 del servidor + 40 pendientes = " + b2.ev("S.xp") + ") sin errores: " + b2.errs.slice(0,2));
  ok(s10b.awards().some(c => c.body.p_event_id === id10 && c.body.p_kind === "boss"), "…y el evento de XP pendiente se envía al servidor tras reiniciar (mismo id)");
  ok(JSON.parse(b2.ls("bitty_xq") || "[]").length === 0, "…y la cola queda vacía");

  // 11) enlace con token en la URL (confirmación, recuperación, enlace mágico): no sustituye progreso ajeno en silencio
  const HASH = "#access_token=TOK&refresh_token=R&expires_in=3600&type=magiclink";
  let asked = [];
  b = await boot({ hash: HASH, confirmFn: m => { asked.push(m); return false; }, store: { bitty: GOOD(), bitty_owner: "otra-cuenta" } });
  ok(asked.length === 1 && /a@b\.com/.test(asked[0]) && /sustituir/.test(asked[0]), "enlace de otra cuenta con progreso local: se pregunta antes (y el mensaje dice qué pasará)");
  ok(b.ev("AU") === null && b.ev("S.xp") === 120 && b.ls("bitty_owner") === "otra-cuenta" && !!b.w.document.querySelector("#cE"), "…si se rechaza: no se inicia sesión, el progreso local sigue intacto y se vuelve al login");
  ok(b.errs.length === 0 && !/access_token/.test(b.w.location.href), "…y el token desaparece de la dirección (no queda en el historial). errores: " + b.errs.slice(0, 2));
  asked = [];
  b = await boot({ hash: HASH, confirmFn: m => { asked.push(m); return true; }, store: { bitty: GOOD(), bitty_owner: "otra-cuenta" } });
  ok(asked.length === 1 && b.ev("AU") !== null && b.ev("AU.id") === "u1", "…si se acepta: inicia sesión con esa cuenta");
  asked = [];
  b = await boot({ hash: HASH, confirmFn: m => { asked.push(m); return true; }, store: { bitty: GOOD(), bitty_owner: "u1" } });
  ok(asked.length === 0 && b.ev("AU") !== null && b.ev("S.xp") >= 0, "enlace de la MISMA cuenta que usa el dispositivo: no se pregunta nada");
  asked = [];
  b = await boot({ hash: HASH, confirmFn: m => { asked.push(m); return true; }, store: { bitty: JSON.stringify({ v: 2, name: "", xp: 0, done: {} }) } });
  ok(asked.length === 0 && b.ev("AU") !== null, "dispositivo sin progreso: no se pregunta");

  // 12) «Borrar todo tu progreso»
  let alerted = [];
  b = await boot({ confirmFn: () => true, store: { bitty: GOOD({ xp: 700 }), bitty_guest: "1", bitty_xq: JSON.stringify([{ id: "1", kind: "level", ref: "lv:g:1:1", xp: 10, day: "2026-11-04" }]) } });
  b.ev("rst()");
  ok(b.ev("S.xp") === 0 && Object.keys(b.ev("S.done")).length === 0 && b.ev("xev().length") === 0 && b.errs.length === 0, "sin cuenta: «Borrar todo tu progreso» reinicia XP, niveles y la cola de XP pendiente");
  const s12 = server(); s12.xp = 700;   // el servidor ya conoce el XP de la cuenta
  b = await boot({ confirmFn: () => true, srv: s12, store: { bitty: GOOD({ xp: 700 }), bitty_auth: AUTH() } });
  b.w.alert = m => alerted.push(m);
  b.ev("rst()");
  ok(alerted.length === 1 && /Eliminar mi cuenta/.test(alerted[0]) && b.ev("S.xp") >= 120 && Object.keys(b.ev("S.done")).length > 0, "con cuenta: no reinicia (evita un progreso incoherente) y explica cómo empezar de cero");

  // 13) camino real encontrado por la prueba «mono»: Perfil → borrar progreso → elegir ruta → botón atrás de Android
  const capb = { cb: null };
  b = await boot({ confirmFn: () => true, store: { bitty: GOOD(), bitty_guest: "1" }, wrap: w => { w.Capacitor = { isNativePlatform: () => false, Plugins: { App: { addListener(n, f) { if (n === "backButton") capb.cb = f; }, exitApp() {} } } }; } });
  b.ev("tab='p';home()");
  b.ev("rst()");
  ok(!!b.w.document.querySelector("#app") && b.ev("S.track") === null && b.errs.length === 0, "tras borrar el progreso se muestra la elección de ruta");
  if (capb.cb) capb.cb({}); b.ev("typeof bback==='function'&&bback()");
  await sleep(50);
  ok(b.errs.length === 0 && b.ev("S.track") === null && /Ana|ruta|route|Python|Java/i.test(b.T()), "…y el botón «atrás» ya no provoca una excepción (antes: Cannot read properties of undefined (reading 'L')). errores: " + b.errs.slice(0, 1));

  // 14) accesibilidad real: los nodos del mapa de ruta tienen nombre (título + estado) para lectores de pantalla
  b = await boot({ store: { bitty: GOOD({ done: { "g:1": 2 } }), bitty_guest: "1" } });
  b.ev("tab='r';home()");
  const nodes = [...b.w.document.querySelectorAll("button.node")];
  ok(nodes.length > 10 && nodes.every(e => (e.getAttribute("aria-label") || "").length > 3), `los ${nodes.length} nodos del mapa tienen aria-label`);
  ok(nodes.some(e => /completado/.test(e.getAttribute("aria-label"))) && nodes.some(e => /bloqueado/.test(e.getAttribute("aria-label"))) && nodes.some(e => /siguiente nivel/.test(e.getAttribute("aria-label"))), "…e indican si están completados, bloqueados o son el siguiente");
  ok(b.w.document.querySelector("button.snd") && b.w.document.querySelector("button.snd").getAttribute("aria-label") === "Sonido", "el botón de sonido tiene nombre");

  // 15) app de escritorio: enlace profundo bitty://confirmed por el puente del preload
  let deepCb = null;
  b = await boot({ store: {}, wrap: w => { w.bittyDesktop = { isDesktop: true, onDeepLink(cb) { deepCb = cb; } }; } });
  ok(typeof deepCb === "function" && !!b.w.document.querySelector("#cE"), "la app registra su manejador en bittyDesktop.onDeepLink y muestra el acceso");
  deepCb("bitty://confirmed"); await sleep(30);
  ok(/¡Correo confirmado! Ya puedes iniciar sesión/.test(b.T()) && !!b.w.document.querySelector("#cE") && b.ev("AU") === null, "bitty://confirmed muestra «¡Correo confirmado!» y deja iniciar sesión (sin iniciarla)");
  for (const bad of ["bitty://confirmed?token_hash=abc", "bitty://confirmed#access_token=x", "bitty://otra", "https://confirmed", "javascript:alert(1)", ""]) {
    b.ev(`AS=1;cmsg="";wl()`); deepCb(bad); await sleep(20);
    ok(!/Correo confirmado/.test(b.T()) && b.ev("AU") === null, `enlace de escritorio no admitido ignorado: «${bad}»`);
  }
  b = await boot({ store: { bitty: GOOD(), bitty_guest: "1" }, wrap: w => { w.bittyDesktop = { isDesktop: true, onDeepLink(cb) { deepCb = cb; } }; } });
  b.ev("go(0)"); deepCb("bitty://confirmed"); await sleep(30);
  ok(!!b.w.document.querySelector('[onclick="xq()"]') && b.errs.length === 0, "con una partida en curso, el enlace no interrumpe (solo un aviso)");

  console.log(`robustness.test: ${n - fails}/${n} comprobaciones correctas`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
