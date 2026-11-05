// Página pública de confirmación de correo (www/auth/confirm/index.html), con un Supabase SIMULADO cuyas respuestas
// replican las reales observadas (403 otp_expired para enlaces inválidos/caducados/usados, 400 validation_failed...).
// Comprueba estados, privacidad del token, ausencia de sesión persistida, reenvío sin enumeración y contenido hostil.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const FILE = process.argv[2] || path.join(__dirname, "..", "www", "auth", "confirm", "index.html");
const HTML = fs.readFileSync(FILE, "utf8");
const BASE = "https://pablofernandezmelero-png.github.io/BITTY_FINAL/auth/confirm/";
const HASH = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8";
const sleep = ms => new Promise(r => setTimeout(r, ms));
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };

async function open(query, { verify = "ok", resend = 200, ua = "Mozilla/5.0 (Windows NT 10.0) Chrome", store = {}, navLang = "es-ES" } = {}) {
  const errs = [], vc = new VirtualConsole(), calls = [], navs = [];
  vc.on("jsdomError", e => errs.push(e.message)); vc.on("error", (...a) => errs.push(a.join(" ")));
  let verifyMode = verify;
  const dom = new JSDOM(HTML, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: BASE + query, userAgent: ua,
    beforeParse(w) {
      Object.defineProperty(w.navigator, "language", { value: navLang, configurable: true });
      Object.defineProperty(w.navigator, "userAgent", { value: ua, configurable: true });
      for (const k in store) w.localStorage.setItem(k, store[k]);
      w.__nav = u => navs.push(u);
      w.fetch = async (url, o = {}) => {
        const u = new URL(url), body = o.body ? JSON.parse(o.body) : null;
        calls.push({ path: u.pathname + u.search, body, headers: o.headers || {}, referrerPolicy: o.referrerPolicy, credentials: o.credentials, host: u.host });
        const R = (s, j) => ({ ok: s < 300, status: s, json: async () => j });
        if (u.pathname === "/auth/v1/verify") {
          if (verifyMode === "ok") return R(200, { access_token: "JWT.TOKEN.SECRET", refresh_token: "r", user: { id: "u1" } });
          if (verifyMode === "expired") return R(403, { code: 403, error_code: "otp_expired", msg: "Email link is invalid or has expired" });
          if (verifyMode === "invalid") return R(400, { code: 400, error_code: "validation_failed", msg: "Verify requires either a token or a token hash" });
          if (verifyMode === "500") return R(500, { msg: "boom" });
          if (verifyMode === "429") return R(429, { msg: "rate" });
          if (verifyMode === "net") throw new TypeError("Failed to fetch");
          if (verifyMode === "okNoSession") return R(200, {});
        }
        if (u.pathname === "/auth/v1/logout") return R(204, null);
        if (u.pathname === "/auth/v1/resend") { if (resend === "net") throw new TypeError("x"); return R(resend, resend === 200 ? {} : { msg: "err" }); }
        return R(404, {});
      };
    } });
  const w = dom.window, d = w.document;
  await sleep(60);
  return { w, d, errs, calls, navs, setVerify: m => { verifyMode = m; },
    state: () => d.getElementById("card").className, title: () => d.getElementById("t").textContent, msg: () => d.getElementById("m").textContent,
    text: () => d.getElementById("card").textContent, btn: t => [...d.querySelectorAll("#act button, #act a")].find(b => b.textContent.includes(t)) };
}
const submit = (p, email) => { p.d.getElementById("em").value = email; p.d.querySelector("#act form").dispatchEvent(new p.w.Event("submit", { cancelable: true, bubbles: true })); };

(async () => {
  // 1) enlace válido
  let p = await open(`?token_hash=${HASH}&type=email`);
  await sleep(60);
  ok(p.state().includes("ok") && /¡Correo confirmado!/.test(p.title()) && /Ya puedes iniciar sesión/.test(p.msg()), "enlace válido: «¡Correo confirmado!». Estado: " + p.state() + " / " + p.title());
  const v = p.calls.find(c => c.path === "/auth/v1/verify");
  ok(v && v.body.type === "email" && v.body.token_hash === HASH && Object.keys(v.body).length === 2, "verify se llama con {type, token_hash} (flujo oficial), sin enviar nada más");
  ok(v.headers.apikey.startsWith("sb_publishable_") && !JSON.stringify(p.calls).includes("service_role") && v.credentials === "omit" && v.referrerPolicy === "no-referrer", "usa solo la clave pública, sin cookies y sin Referer");
  ok(p.calls.every(c => c.host === "tewlouwqlpjmrifvhrhz.supabase.co"), "todas las peticiones van al proyecto de Supabase y a ningún otro dominio");
  ok(!p.w.location.search.includes("token_hash") && !p.w.location.href.includes(HASH), "el token se borra de la dirección (no queda en el historial)");
  const lg = p.calls.find(c => c.path === "/auth/v1/logout?scope=local");
  ok(lg && lg.headers.Authorization === "Bearer JWT.TOKEN.SECRET", "la sesión que devuelve Supabase se REVOCA (solo este dispositivo) en vez de conservarse");
  const keys = []; for (let i = 0; i < p.w.localStorage.length; i++) keys.push(p.w.localStorage.key(i));
  for (let i = 0; i < p.w.sessionStorage.length; i++) keys.push("s:" + p.w.sessionStorage.key(i));
  ok(!JSON.stringify(keys).match(/auth|token|JWT|session/i) && !p.d.documentElement.outerHTML.includes("JWT.TOKEN.SECRET"), "no se guarda ninguna sesión ni token (ni en el almacenamiento ni en la página): " + JSON.stringify(keys));
  ok(!!p.btn("Volver a Bitty") && !!p.btn("Abrir la app de escritorio"), "botón «Volver a Bitty» y enlace a la app de escritorio (en un PC)");
  p.btn("Volver a Bitty").click();
  ok(p.navs.length === 1 && p.navs[0] === "https://pablofernandezmelero-png.github.io/BITTY_FINAL/", "en un PC, «Volver a Bitty» lleva a la web de Bitty: " + p.navs);
  ok(p.btn("Abrir la app de escritorio").getAttribute("href") === "bitty://confirmed", "el enlace de escritorio usa el protocolo propio bitty://");
  ok(p.errs.length === 0, "sin errores de JavaScript: " + p.errs.slice(0, 2));
  // recargar tras confirmar no muestra «enlace no válido»
  const again = await open("", { store: {} });
  ok(again.state().includes("bad"), "sin parámetros y sin confirmación previa: enlace no válido");

  // 2) caducado / ya usado
  p = await open(`?token_hash=${HASH}&type=signup`, { verify: "expired" }); await sleep(60);
  ok(p.state().includes("warn") && /ya no es válido/.test(p.title()) && /caducado o ya se ha usado/.test(p.msg()), "403 otp_expired: «ha caducado o ya se ha usado» (Supabase no distingue ambos casos)");
  ok(!!p.d.getElementById("em") && !!p.btn("Enviarme un enlace nuevo"), "…y ofrece pedir un enlace nuevo");
  ok(!p.calls.some(c => c.path.startsWith("/auth/v1/logout")), "sin sesión que revocar");

  // 3) inválido
  for (const [q, why] of [["", "sin parámetros"], [`?token_hash=corto&type=email`, "token demasiado corto"], [`?token=123456&type=signup`, "OTP de 6 cifras (no sirve sin el correo)"], [`?token_hash=${HASH}`, "sin tipo"], [`?token_hash=${HASH}&type=recovery`, "tipo no permitido (recuperación)"], [`?token_hash=${HASH}&type=magiclink`, "tipo no permitido (enlace mágico)"], [`?token_hash=${HASH}&type=<img src=x onerror=1>`, "tipo con HTML"], [`?token_hash=${encodeURIComponent("<script>alert(1)</script>aaaaaaaaaaaaaaaaaaaa")}&type=email`, "token con HTML"]]) {
    p = await open(q);
    ok(p.state().includes("bad") && /Enlace no válido/.test(p.title()) && !p.calls.some(c => c.path === "/auth/v1/verify"), `${why}: «Enlace no válido» y NO se llama a Supabase`);
    ok(!p.d.querySelector("#card img, #card script") , `${why}: no se inyecta HTML`);
  }
  p = await open(`?token_hash=${HASH}&type=email`, { verify: "invalid" }); await sleep(60);
  ok(p.state().includes("bad") && /Enlace no válido/.test(p.title()), "400 del servidor: enlace no válido");

  // 4) error de servidor y de red; reintento
  for (const m of ["500", "429", "net"]) {
    p = await open(`?token_hash=${HASH}&type=email`, { verify: m }); await sleep(60);
    ok(p.state().includes("bad") && /No hemos podido verificar/.test(p.title()) && !!p.btn("Reintentar"), `error ${m}: mensaje de error y botón «Reintentar»`);
  }
  p = await open(`?token_hash=${HASH}&type=email`, { verify: "500" }); await sleep(60);
  p.setVerify("ok"); p.btn("Reintentar").click(); await sleep(80);
  ok(p.state().includes("ok") && p.calls.filter(c => c.path === "/auth/v1/verify").length === 2 && p.calls.filter(c => c.path === "/auth/v1/verify").every(c => c.body.token_hash === HASH), "tras un error temporal, «Reintentar» vuelve a verificar con el mismo enlace y funciona");
  p = await open(`?token_hash=${HASH}&type=email_change`, { verify: "okNoSession" }); await sleep(60);
  ok(p.state().includes("ok") && !p.calls.some(c => c.path.startsWith("/auth/v1/logout")), "respuesta correcta sin sesión (cambio de correo): confirmado y sin intentar revocar nada");

  // 5) reenvío
  p = await open(`?token_hash=${HASH}&type=signup`, { verify: "expired" }); await sleep(60);
  submit(p, "no-es-un-correo"); await sleep(20);
  ok(/correo válido/.test(p.d.querySelector("#act form p").textContent) && !p.calls.some(c => c.path.startsWith("/auth/v1/resend")), "correo inválido: aviso y sin llamada");
  submit(p, "ana@example.com"); await sleep(60);
  const rs = p.calls.find(c => c.path.startsWith("/auth/v1/resend"));
  ok(rs && rs.body.type === "signup" && rs.body.email === "ana@example.com" && decodeURIComponent(rs.path).includes("redirect_to=https://pablofernandezmelero-png.github.io/BITTY_FINAL/auth/confirm/"), "reenvío: type=signup, correo y redirect_to a la página de confirmación");
  ok(/Si existe una cuenta pendiente/.test(p.d.querySelector("#act form p").textContent), "la respuesta no revela si el correo está registrado");
  submit(p, "otra@example.com"); await sleep(40);
  ok(p.calls.filter(c => c.path.startsWith("/auth/v1/resend")).length === 1 && /Espera un poco/.test(p.d.querySelector("#act form p").textContent), "segundo reenvío en menos de 60 s: bloqueado en el cliente");
  p = await open(`?token_hash=${HASH}&type=signup`, { verify: "expired", resend: 400 }); await sleep(60);
  submit(p, "noexiste@example.com"); await sleep(60);
  const m400 = p.d.querySelector("#act form p").textContent;
  p = await open(`?token_hash=${HASH}&type=signup`, { verify: "expired", resend: 200 }); await sleep(60);
  submit(p, "existe@example.com"); await sleep(60);
  ok(m400 === p.d.querySelector("#act form p").textContent, "misma respuesta si el servidor rechaza o acepta (sin enumeración de cuentas)");
  p = await open(`?token_hash=${HASH}&type=signup`, { verify: "expired", resend: 429 }); await sleep(60);
  submit(p, "a@b.co"); await sleep(60);
  ok(/Espera un poco/.test(p.d.querySelector("#act form p").textContent), "429 del servidor: pide esperar");
  p = await open(`?token_hash=${HASH}&type=signup`, { verify: "expired", resend: 500 }); await sleep(60);
  submit(p, "a@b.co"); await sleep(60);
  ok(/No se pudo enviar/.test(p.d.querySelector("#act form p").textContent) && !p.d.querySelector("#act form button").disabled, "error del servidor: avisa y deja reintentar");

  // 6) Android y escritorio
  p = await open(`?token_hash=${HASH}&type=email`, { ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile" }); await sleep(60);
  ok(!p.btn("Abrir la app de escritorio"), "en Android no se ofrece la app de escritorio");
  p.btn("Volver a Bitty").click();
  ok(p.navs[0] === "com.bitty.app://confirmed", "en Android, «Volver a Bitty» intenta abrir la app con el enlace profundo: " + p.navs[0]);
  await sleep(1750);
  ok(p.navs[1] === "https://pablofernandezmelero-png.github.io/BITTY_FINAL/", "…y si la app no está instalada (la página sigue visible) vuelve a la web");
  p = await open(`?token_hash=${HASH}&type=email`, { ua: "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile" }); await sleep(60);
  p.btn("Volver a Bitty").click();
  Object.defineProperty(p.d, "hidden", { value: true, configurable: true }); p.d.dispatchEvent(new p.w.Event("visibilitychange"));
  await sleep(1750);
  ok(p.navs.length === 1, "…y si la app se abre (la página queda oculta) no se redirige a la web");

  // 7) idiomas
  p = await open(`?token_hash=${HASH}&type=email&lang=en`); await sleep(60);
  ok(/Email confirmed!/.test(p.title()) && p.d.documentElement.lang === "en" && /Back to Bitty/.test(p.text()) && p.w.location.search === "?lang=en", "inglés (?lang=en), conservado en la dirección");
  p = await open(`?token_hash=${HASH}&type=email&lang=nl`); await sleep(60);
  ok(/E-mail bevestigd!/.test(p.title()) && p.d.documentElement.lang === "nl", "neerlandés (?lang=nl)");
  p = await open(`?token_hash=${HASH}&type=email&lang=<b>fr</b>`); await sleep(60);
  ok(p.d.documentElement.lang === "es" && /¡Correo confirmado!/.test(p.title()), "un idioma no válido o con HTML vuelve a español");

  // 8) comprobaciones estáticas del archivo
  ok(/Content-Security-Policy/.test(HTML) && /default-src 'none'/.test(HTML) && /connect-src https:\/\/tewlouwqlpjmrifvhrhz\.supabase\.co(;|")/.test(HTML), "CSP restrictiva: connect-src solo al proyecto de Supabase");
  ok(/name="referrer" content="no-referrer"/.test(HTML) && /name="robots" content="noindex/.test(HTML), "referrer no-referrer (el token no se filtra) y noindex");
  const urls = [...HTML.matchAll(/https?:\/\/[^"'\s)<]+/g)].map(m => m[0]).filter(u => !/w3\.org/.test(u));
  ok(urls.every(u => /supabase\.co|pablofernandezmelero-png\.github\.io/.test(u)), "ningún recurso externo (ni fuentes ni CDNs): " + urls.filter(u => !/supabase\.co|pablofernandezmelero-png\.github\.io/.test(u)));
  ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/.test(HTML), "sin innerHTML, eval ni document.write: todo el texto se inserta con textContent");
  ok(!/sb_secret_|service_role|eyJ[A-Za-z0-9_-]{20,}\./.test(HTML), "sin claves secretas ni JWT en la página");
  ok(/prefers-reduced-motion/.test(HTML) && /prefers-color-scheme:dark/.test(HTML) && /focus-visible/.test(HTML) && /aria-live="polite"/.test(HTML), "accesibilidad: movimiento reducido, modo oscuro, foco visible y aviso aria-live");

  console.log(`confirm.test: ${n - fails}/${n} comprobaciones correctas`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
