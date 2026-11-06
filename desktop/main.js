"use strict";
// Bitty para escritorio (Electron). Carga la web desde el protocolo propio app://bitty (archivos de ./www, nunca rutas
// absolutas) con el renderizador aislado: sin Node, con sandbox, sin menú, permisos denegados y navegación bloqueada.
const { app, BrowserWindow, protocol, net, shell, session, Menu, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const sec = require("./security");

const WEB_ROOT = path.join(__dirname, "www");
const SMOKE = process.env.BITTY_SMOKE === "1";            // modo de comprobación automática (tests); nunca en uso normal

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let win = null, pendingDeep = sec.deepLinkFromArgv(process.argv);

// Versión de esta instalación (1.0.N, N = compilación): la web la usa para avisar de una versión nueva. Solo se responde a la propia app (app://bitty).
ipcMain.on("bitty-version", e => { e.returnValue = (e.senderFrame && sec.isInternalUrl(e.senderFrame.url)) ? app.getVersion() : ""; });

function sendDeep(url) {
  if (win && !win.webContents.isLoading()) win.webContents.send("bitty-deep", url);
  else pendingDeep = url;
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
}

function createWindow() {
  win = new BrowserWindow({
    width: 560, height: 900, minWidth: 420, minHeight: 650,
    title: "Bitty", autoHideMenuBar: true, backgroundColor: "#f4f3ff",
    show: !SMOKE,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      allowRunningInsecureContent: false, webviewTag: false, spellcheck: false,
      devTools: !app.isPackaged
    }
  });
  win.webContents.on("did-finish-load", () => {
    if (pendingDeep) { win.webContents.send("bitty-deep", pendingDeep); pendingDeep = null; }
  });
  win.on("closed", () => { win = null; });
  win.loadURL(sec.APP_ORIGIN + "/index.html");
  return win;
}

function hardenSession() {
  // Sin permisos (cámara, micrófono, ubicación, notificaciones…): Bitty no los necesita.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
}

app.on("web-contents-created", (_e, contents) => {
  contents.on("will-attach-webview", ev => ev.preventDefault());
  contents.on("will-navigate", (ev, url) => {                       // solo se navega dentro de la app
    if (!sec.isInternalUrl(url)) { ev.preventDefault(); if (sec.isAllowedExternal(url)) shell.openExternal(url); }
  });
  contents.setWindowOpenHandler(({ url }) => { if (sec.isAllowedExternal(url)) shell.openExternal(url); return { action: "deny" }; });
});

const gotLock = SMOKE || app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => { const d = sec.deepLinkFromArgv(argv); if (d) sendDeep(d); else if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.on("open-url", (ev, url) => { ev.preventDefault(); const d = sec.parseDeepLink(url); if (d) sendDeep(d); });   // macOS

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    hardenSession();
    protocol.handle("app", async req => {
      const file = sec.resolveAppFile(WEB_ROOT, req.url);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("No encontrado", { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });
    // Registrar bitty:// en el sistema solo en la app instalada (el instalador NSIS también lo hace); nunca al desarrollar ni en las pruebas.
    if (app.isPackaged && !SMOKE) app.setAsDefaultProtocolClient("bitty");
    createWindow();
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
    if (SMOKE) runSmoke();
  });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}

// ---- Comprobación automática: BITTY_SMOKE=1 BITTY_SMOKE_OUT=ruta.json electron desktop --user-data-dir=<temporal> ----
function runSmoke() {
  const out = process.env.BITTY_SMOKE_OUT;
  const guard = setTimeout(() => { fs.writeFileSync(out, JSON.stringify({ error: "tiempo agotado" })); app.exit(2); }, 30000);
  win.webContents.once("did-finish-load", async () => {
    try {
      await new Promise(r => setTimeout(r, 1500));
      const wc = win.webContents;
      const facts = await wc.executeJavaScript(`(function(){
        const r={href:location.href,title:document.title,lang:document.documentElement.lang,
          hasRequire:typeof require,hasProcess:typeof process,hasModule:typeof module,
          bitty:Object.keys(window.bittyDesktop||{}).sort(),bittyVersion:String((window.bittyDesktop||{}).version||""),isDesktop:!!(window.bittyDesktop&&window.bittyDesktop.isDesktop),
          loginVisible:!!document.querySelector("#cE"),
          cspMeta:!!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
          storage:(function(){try{localStorage.setItem("smoke","1");const ok=localStorage.getItem("smoke")==="1";localStorage.removeItem("smoke");return ok}catch(e){return false}})()};
        return JSON.stringify(r)})()`);
      const res = JSON.parse(facts);
      res.guest = await wc.executeJavaScript(`(function(){try{gst();return !document.querySelector("#cE")}catch(e){return String(e)}})()`);
      // intentos de salirse: navegar a una web externa y abrir una ventana nueva deben quedar bloqueados
      await wc.executeJavaScript(`(function(){try{window.open("https://example.com");}catch(e){}try{location.href="https://example.com/"}catch(e){}})()`).catch(() => {});
      await new Promise(r => setTimeout(r, 800));
      res.afterEscape = { href: wc.getURL(), windows: BrowserWindow.getAllWindows().length };
      // la ruta del protocolo no permite salir de ./www
      const probe = async u => { try { const r = await net.fetch(u); return r.status; } catch (e) { return "error"; } };
      res.protocol = {
        index: await probe("app://bitty/index.html"), confirm: await probe("app://bitty/auth/confirm/"),
        traversal: await probe("app://bitty/../main.js"), traversalEnc: await probe("app://bitty/%2e%2e/main.js"), traversalWin: await probe("app://bitty/..%5Cmain.js"),
        outside: await probe("app://bitty/../../package.json"), otherHost: await probe("app://otro/index.html")
      };
      res.userData = app.getPath("userData");
      fs.writeFileSync(out, JSON.stringify(res, null, 1));
      clearTimeout(guard); app.exit(0);
    } catch (e) { fs.writeFileSync(out, JSON.stringify({ error: String(e && e.stack || e) })); app.exit(3); }
  });
}
