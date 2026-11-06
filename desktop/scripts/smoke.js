// Arranca la app de escritorio en modo comprobación (ventana oculta, datos en una carpeta temporal) y valida lo esencial.
//   ELECTRON_BIN=<ruta a electron(.exe)> node scripts/smoke.js      (por defecto, el de node_modules)
const { spawnSync } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
require("./copy-web.js");
const bin = process.env.ELECTRON_BIN || require("electron");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bitty-smoke-"));
const out = path.join(tmp, "result.json");
const r = spawnSync(bin, [path.join(__dirname, ".."), "--user-data-dir=" + path.join(tmp, "userdata")], { env: { ...process.env, BITTY_SMOKE: "1", BITTY_SMOKE_OUT: out }, timeout: 60000, encoding: "utf8" });
if (!fs.existsSync(out)) { console.error("La app no produjo resultado. Código:", r.status, r.stderr && r.stderr.slice(0, 500)); process.exit(1); }
const res = JSON.parse(fs.readFileSync(out, "utf8"));
console.log(JSON.stringify(res, null, 1));
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("  FALLA: " + m); } else console.log("  ok: " + m); };
ok(!res.error, "sin error interno " + (res.error || ""));
ok(/^app:\/\/bitty\/index\.html/.test(res.href), "carga desde app://bitty (no file://)");
ok(res.hasRequire === "undefined" && res.hasProcess === "undefined" && res.hasModule === "undefined", "el renderizador NO tiene require/process/module (sin Node)");
ok(res.isDesktop && JSON.stringify(res.bitty) === JSON.stringify(["isDesktop", "onDeepLink", "platform", "version"]), "solo se expone bittyDesktop {isDesktop, onDeepLink, platform, version}");
ok(res.bittyVersion === require("../package.json").version, "la web recibe la versión instalada por el canal seguro (IPC solo desde app://bitty): " + res.bittyVersion);
ok(res.storage, "localStorage funciona (el progreso se conserva)");
ok(res.cspMeta, "la CSP de la web está activa");
ok(res.loginVisible && res.guest === true, "la pantalla de acceso se muestra y el modo invitado funciona");
ok(/^app:\/\/bitty\//.test(res.afterEscape.href) && res.afterEscape.windows === 1, "navegar a una web externa y abrir ventanas nuevas queda bloqueado");
ok(res.protocol.index === 200 && res.protocol.confirm === 200, "el protocolo sirve index y la página de confirmación");
ok([res.protocol.traversal, res.protocol.traversalEnc, res.protocol.traversalWin, res.protocol.outside, res.protocol.otherHost].every(s => s === 404 || s === "error"), "intentos de salirse de ./www y otros hosts: bloqueados " + JSON.stringify(res.protocol));
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(fails ? 1 : 0);
