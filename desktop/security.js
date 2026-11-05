"use strict";
// Lógica de seguridad de la app de escritorio, SIN depender de Electron (así se prueba con Node: tests/desktop.test.js).
const path = require("path");

const APP_ORIGIN = "app://bitty";
// Únicos orígenes web que se pueden abrir en el navegador del sistema desde la app (la web publicada de Bitty).
const EXTERNAL_ALLOW = new Set(["https://pablofernandezmelero-png.github.io"]);

// Convierte app://bitty/<ruta> en un archivo DENTRO de rootDir; null si es otra cosa o intenta salirse (../, \, %2e%2e, NUL…).
function resolveAppFile(rootDir, urlStr) {
  let u;
  try { u = new URL(urlStr); } catch (e) { return null; }
  if (u.protocol !== "app:" || u.hostname !== "bitty" || u.username || u.password || u.port) return null;
  let p;
  try { p = decodeURIComponent(u.pathname); } catch (e) { return null; }
  if (p.includes("\0") || p.includes("\\")) return null;
  if (p === "" || p === "/") p = "/index.html";
  else if (p.endsWith("/")) p += "index.html";                     // app://bitty/auth/confirm/ -> .../auth/confirm/index.html
  const root = path.resolve(rootDir);
  const abs = path.resolve(root, "." + p);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return abs;
}

// ¿La dirección pertenece a la propia app? (solo se puede navegar dentro de app://bitty)
function isInternalUrl(u) {
  return typeof u === "string" && (u === APP_ORIGIN || u.startsWith(APP_ORIGIN + "/"));
}

// ¿Se puede abrir en el navegador del sistema? Solo https hacia la web de Bitty, sin credenciales en la URL.
function isAllowedExternal(u) {
  try {
    const x = new URL(String(u));
    return x.protocol === "https:" && EXTERNAL_ALLOW.has(x.origin) && !x.username && !x.password;
  } catch (e) { return false; }
}

// Único enlace profundo admitido: bitty://confirmed (sin ruta, parámetros ni fragmento). Nunca lleva datos.
function parseDeepLink(arg) {
  try {
    const x = new URL(String(arg));
    if (x.protocol === "bitty:" && x.hostname === "confirmed" && !x.search && !x.hash && !x.username && !x.password && (x.pathname === "" || x.pathname === "/")) return "bitty://confirmed";
  } catch (e) { /* no es una URL */ }
  return null;
}
function deepLinkFromArgv(argv) {
  for (const a of Array.isArray(argv) ? argv : []) { const d = parseDeepLink(a); if (d) return d; }
  return null;
}

module.exports = { APP_ORIGIN, EXTERNAL_ALLOW, resolveAppFile, isInternalUrl, isAllowedExternal, parseDeepLink, deepLinkFromArgv };
