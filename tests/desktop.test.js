// App de escritorio (Electron): lógica de seguridad (sin necesitar Electron) y configuración endurecida.
// La comprobación con Electron REAL está en desktop/scripts/smoke.js (npm run smoke dentro de desktop/).
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const D = p => path.join(root, "desktop", p);
const sec = require(D("security.js"));
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };
const R = path.resolve(root, "desktop", "www");
const inside = f => !!f && path.relative(R, f) && !path.relative(R, f).startsWith("..") && !path.isAbsolute(path.relative(R, f));

// ---- resolveAppFile: nunca sale de ./www
ok(sec.resolveAppFile(R, "app://bitty/index.html") === path.join(R, "index.html"), "index.html");
ok(sec.resolveAppFile(R, "app://bitty/") === path.join(R, "index.html") && sec.resolveAppFile(R, "app://bitty") === path.join(R, "index.html"), "la raíz sirve index.html");
ok(sec.resolveAppFile(R, "app://bitty/auth/confirm/") === path.join(R, "auth", "confirm", "index.html"), "carpeta con barra final -> su index.html");
ok(sec.resolveAppFile(R, "app://bitty/auth/confirm/index.html?x=1#y") === path.join(R, "auth", "confirm", "index.html"), "consulta y fragmento se ignoran");
for (const bad of [
  "app://bitty/../main.js", "app://bitty/%2e%2e/main.js", "app://bitty/%2E%2E/%2e%2e/package.json", "app://bitty/..%2fmain.js", "app://bitty/a/..%2f..%2fmain.js",
  "app://bitty/..\\main.js", "app://bitty/a%5C..%5Cmain.js", "app://bitty/%00", "app://bitty/index.html%00.png", "app://bitty/%zz",
  "app://otro/index.html", "app://bitty@evil/index.html", "app://user:pw@bitty/index.html", "app://bitty:8080/index.html",
  "file:///C:/Windows/win.ini", "https://bitty/index.html", "http://bitty/index.html", "javascript:alert(1)", "", "no es una url", null, undefined, 42]) {
  const f = (() => { try { return sec.resolveAppFile(R, bad); } catch (e) { return "EXCEPCIÓN: " + e.message; } })();
  // La URL se normaliza antes de llegar (../ y %2e%2e desaparecen), así que lo esencial es que NUNCA devuelva un archivo real fuera de www
  const real = [path.join(root, "desktop", "main.js"), path.join(root, "desktop", "package.json"), path.join(root, "package.json"), "C:\Windows\win.ini"].map(x => path.resolve(x).toLowerCase());
  ok(f === null || (typeof f === "string" && !f.startsWith("EXC") && inside(f) && !real.includes(path.resolve(f).toLowerCase())), `ruta hostil rechazada o contenida: ${JSON.stringify(bad)} -> ${f}`);
}
for (const odd of ["app://bitty//server/share/x", "app://bitty/C:/Windows/win.ini", "app://bitty/%2F%2Fetc/passwd", "app://bitty/./././index.html"]) {
  const f = sec.resolveAppFile(R, odd);
  ok(f === null || inside(f), `ruta rara contenida dentro de www: ${odd} -> ${f}`);
}

// ---- navegación interna y externa
ok(sec.isInternalUrl("app://bitty/index.html") && sec.isInternalUrl("app://bitty") && sec.isInternalUrl("app://bitty/auth/confirm/"), "URLs internas");
for (const u of ["app://bittyevil/x", "app://bitty.evil.com/x", "https://bitty/x", "file:///x", "about:blank", "", null, undefined, 5]) ok(!sec.isInternalUrl(u), `no es interna: ${u}`);
ok(sec.isAllowedExternal("https://pablofernandezmelero-png.github.io/BITTY_FINAL/") && sec.isAllowedExternal("https://pablofernandezmelero-png.github.io/BITTY_FINAL/auth/confirm/?lang=es"), "se permite abrir la web publicada de Bitty");
for (const u of ["http://pablofernandezmelero-png.github.io/BITTY_FINAL/", "https://pablofernandezmelero-png.github.io.evil.com/", "https://evil.com/pablofernandezmelero-png.github.io", "https://user:pw@pablofernandezmelero-png.github.io/", "https://pablofernandezmelero-png.github.io@evil.com/", "https://example.com", "javascript:alert(1)", "file:///C:/Windows/win.ini", "data:text/html,<script>alert(1)</script>", "ftp://pablofernandezmelero-png.github.io/", "smb://x/y", "ms-msdt:/id", "vbscript:x", "", null, 7]) ok(!sec.isAllowedExternal(u), `no se abre fuera: ${u}`);

// ---- enlace profundo: solo bitty://confirmed exacto
ok(sec.parseDeepLink("bitty://confirmed") === "bitty://confirmed" && sec.parseDeepLink("bitty://confirmed/") === "bitty://confirmed" && sec.parseDeepLink("BITTY://confirmed") === "bitty://confirmed", "bitty://confirmed válido (el esquema no distingue mayúsculas)");
ok(sec.parseDeepLink("bitty://CONFIRMED") === null, "el host sí es estricto: solo «confirmed» en minúsculas");
for (const u of ["bitty://confirmed?token_hash=abc", "bitty://confirmed#access_token=x", "bitty://confirmed/../x", "bitty://confirmed/otra", "bitty://otra", "bitty://user:pw@confirmed", "bitty:confirmed", "com.bitty.app://confirmed", "https://confirmed", "--flag", "C:\\ruta\\Bitty.exe", "", null, undefined]) ok(sec.parseDeepLink(u) === null, `enlace profundo no válido: ${u}`);
ok(sec.deepLinkFromArgv(["C:\\Bitty.exe", "--flag", "bitty://confirmed?x=1", "bitty://confirmed"]) === "bitty://confirmed" && sec.deepLinkFromArgv(["a", "b"]) === null && sec.deepLinkFromArgv(null) === null, "se toma el primer enlace válido de los argumentos");

// ---- configuración endurecida (estática)
const main = fs.readFileSync(D("main.js"), "utf8"), pre = fs.readFileSync(D("preload.js"), "utf8");
const pj = JSON.parse(fs.readFileSync(D("package.json"), "utf8"));
for (const [re, m] of [[/contextIsolation:\s*true/, "contextIsolation: true"], [/nodeIntegration:\s*false/, "nodeIntegration: false"], [/sandbox:\s*true/, "sandbox: true"], [/webSecurity:\s*true/, "webSecurity: true"], [/webviewTag:\s*false/, "webviewTag: false"], [/allowRunningInsecureContent:\s*false/, "sin contenido inseguro"], [/devTools:\s*!app\.isPackaged/, "DevTools solo en desarrollo"],
  [/setPermissionRequestHandler\([\s\S]*?cb\(false\)/, "permisos denegados"], [/setPermissionCheckHandler\(\(\)\s*=>\s*false\)/, "comprobaciones de permisos denegadas"], [/will-navigate/, "bloqueo de navegación"], [/setWindowOpenHandler/, "bloqueo de ventanas nuevas"], [/will-attach-webview/, "bloqueo de webview"], [/Menu\.setApplicationMenu\(null\)/, "sin menú"], [/requestSingleInstanceLock/, "instancia única"], [/registerSchemesAsPrivileged/, "protocolo propio"]])
  ok(re.test(main), "main.js: " + m);
ok(!/nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false|webSecurity:\s*false|enableRemoteModule|webviewTag:\s*true|loadFile\(|file:\/\/|allowRunningInsecureContent:\s*true|disable-web-security/.test(main), "main.js: sin opciones inseguras ni rutas file://");
ok(/if \(app\.isPackaged && !SMOKE\) app\.setAsDefaultProtocolClient\("bitty"\)/.test(main) && (main.match(/setAsDefaultProtocolClient/g) || []).length === 1, "main.js: el protocolo bitty:// solo se registra en la app instalada (no al desarrollar ni en pruebas)");
ok(/path\.join\(__dirname, "www"\)/.test(main) && !/[A-Za-z]:\\\\/.test(main), "main.js: la web se carga con rutas relativas a __dirname");
ok(/Object\.freeze/.test(pre) && !/exposeInMainWorld\([^)]*ipcRenderer\b[^)]*\)/.test(pre) && /url === "bitty:\/\/confirmed"/.test(pre), "preload: API congelada, no expone ipcRenderer y solo reenvía bitty://confirmed");
ok(parseInt(pj.devDependencies.electron.replace(/[^\d.]/g, ""), 10) >= 45 && /electron-builder/.test(JSON.stringify(pj.devDependencies)), "Electron ≥ 45 (las 39.x tienen avisos de seguridad altos corregidos en la 45.2.3) y electron-builder");
ok(pj.build.files.includes("main.js") && pj.build.files.includes("preload.js") && pj.build.files.includes("security.js") && pj.build.files.some(f => /^www\//.test(f)), "el instalador incluye main, preload, security y la web");
ok(pj.build.protocols && pj.build.protocols[0].schemes[0] === "bitty" && pj.build.win.target[0].target === "nsis" && pj.build.appId === "com.bitty.desktop", "instalador NSIS con protocolo bitty:// y appId com.bitty.desktop");
ok(!JSON.stringify(pj).match(/"asar"\s*:\s*false/), "asar sin desactivar");
ok(/node_modules/.test(fs.readFileSync(D(".gitignore"), "utf8")) && /dist/.test(fs.readFileSync(D(".gitignore"), "utf8")) && /www/.test(fs.readFileSync(D(".gitignore"), "utf8")), "desktop/.gitignore excluye node_modules, dist y la copia de www");
ok(fs.existsSync(path.join(root, ".github", "workflows", "desktop-windows.yml")), "existe el workflow de compilación para Windows");

// ---- icono de Windows: .ico real (varios tamaños, imágenes PNG) y referenciado desde electron-builder
const ico = fs.existsSync(D("build/icon.ico")) ? fs.readFileSync(D("build/icon.ico")) : Buffer.alloc(0);
ok(ico.length > 6 && ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1, "desktop/build/icon.ico es un icono válido");
const icoN = ico.length > 6 ? ico.readUInt16LE(4) : 0, icoSizes = [];
for (let i = 0; i < icoN; i++) { const o = 6 + 16 * i, w = ico[o] || 256, len = ico.readUInt32LE(o + 8), off = ico.readUInt32LE(o + 12); icoSizes.push(w); ok(off + len <= ico.length && ico.slice(off + 1, off + 4).toString() === "PNG", "entrada " + w + " del .ico contiene un PNG íntegro"); }
ok([16, 32, 48, 256].every(s => icoSizes.includes(s)), "el .ico incluye 16, 32, 48 y 256 px (Windows lo necesita para barra de tareas, escritorio y tienda)");
ok(pj.build.win.icon === "build/icon.ico" && pj.build.nsis.installerIcon === "build/icon.ico", "electron-builder usa el icono en el programa y en el instalador");

console.log(`desktop.test:${n - fails}/${n} comprobaciones correctas`);
process.exit(fails ? 1 : 0);
