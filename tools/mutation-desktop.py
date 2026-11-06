# Pruebas de mutación de la app de escritorio: rompe una regla de seguridad cada vez y comprueba que tests/desktop.test.js falla.
# Restaura siempre los archivos originales (byte a byte).   python tools/mutation-desktop.py
import os, subprocess, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda f: os.path.join(root, "desktop", f)
NL = "\n"
M = [
 (D("security.js"), "se puede salir de la carpeta www", 'if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;', ''),
 (D("security.js"), "se abre cualquier web externa", 'EXTERNAL_ALLOW.has(x.origin)', 'true'),
 (D("security.js"), "se abren enlaces http (sin cifrar)", 'x.protocol === "https:" && EXTERNAL_ALLOW.has(x.origin)', 'EXTERNAL_ALLOW.has(x.origin.replace("http:", "https:"))'),
 (D("security.js"), "el enlace profundo acepta parámetros", '!x.search && !x.hash', '!x.hash'),
 (D("security.js"), "el enlace profundo acepta otros hosts", 'x.hostname === "confirmed" &&', 'true &&'),
 (D("security.js"), "se considera interna una URL parecida (app://bittyevil)", 'u.startsWith(APP_ORIGIN + "/")', 'u.startsWith(APP_ORIGIN)'),
 (D("security.js"), "se aceptan credenciales en la URL externa", ' && !x.username && !x.password;', ';'),
 (D("main.js"), "se desactiva el aislamiento de contexto", 'contextIsolation: true', 'contextIsolation: false'),
 (D("main.js"), "se activa Node en la página", 'nodeIntegration: false', 'nodeIntegration: true'),
 (D("main.js"), "se desactiva el sandbox", 'sandbox: true', 'sandbox: false'),
 (D("main.js"), "se permiten webviews", 'webviewTag: false', 'webviewTag: true'),
 (D("main.js"), "se deja de bloquear la navegación", 'contents.on("will-navigate"', 'contents.on("did-navigate"'),
 (D("main.js"), "se conceden permisos", '(_wc, _perm, cb) => cb(false)', '(_wc, _perm, cb) => cb(true)'),
 (D("main.js"), "DevTools siempre activas", 'devTools: !app.isPackaged', 'devTools: true'),
 (D("main.js"), "bitty:// se registra también al desarrollar y en pruebas", 'if (app.isPackaged && !SMOKE) app.setAsDefaultProtocolClient("bitty");', 'app.setAsDefaultProtocolClient("bitty");'),
 (D("main.js"), "se vuelve a mostrar el menú", 'Menu.setApplicationMenu(null);', ''),
 (D("preload.js"), "el preload expone ipcRenderer", 'isDesktop: true,', 'isDesktop: true, ipc: ipcRenderer,'),
 (D("preload.js"), "el preload reenvía cualquier URL", 'if (url === "bitty://confirmed") cb(url);', 'cb(url);'),
 (D("main.js"), "main responde la versión a cualquier página", 'sec.isInternalUrl(e.senderFrame.url)) ? app.getVersion() : ""', 'true) ? app.getVersion() : ""'),
 (D("preload.js"), "el preload no valida la versión recibida", r'/^\d{1,3}\.\d{1,3}\.\d{1,6}$/.test(v) ? v : ""', 'true ? v : ""'),
 (D("package.json"), "vuelve Electron 39 (con avisos altos)", '"electron": "^45.2.3"', '"electron": "^39.8.10"'),
 (D("package.json"), "el instalador deja de registrar bitty://", '"bitty"' + NL + '        ]', '"otro"' + NL + '        ]'),
]
bad = 0
for path, why, a, b in M:
    raw = open(path, "rb").read()                      # original, para restaurarlo exactamente
    text = raw.decode("utf-8").replace("\r\n", NL)     # comparación con saltos de línea normalizados
    if a not in text:
        print("NO APLICABLE  ", why); bad += 1; continue
    open(path, "wb").write(text.replace(a, b, 1).encode("utf-8"))
    try:
        r = subprocess.run(["node", os.path.join(root, "tests", "desktop.test.js")], capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=root)
    finally:
        open(path, "wb").write(raw)
    print(("DETECTADA   " if r.returncode else "¡SOBREVIVE!  ") + why)
    bad += 0 if r.returncode else 1
print(f"\n{len(M) - bad}/{len(M)} mutaciones detectadas")
sys.exit(1 if bad else 0)
