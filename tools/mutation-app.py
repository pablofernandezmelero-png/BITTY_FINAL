# Pruebas de mutación de la app (registro, reenvío, cierre de sesión, enlace profundo, contraseña, manifiesto):
# rompe una regla cada vez y comprueba que cloud.test.js o android.test.js falla. Restaura siempre los archivos.
#   python tools/mutation-app.py
import subprocess, os, sys
root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = os.path.join(root, "www", "index.html"); MF = os.path.join(root, "android", "app", "src", "main", "AndroidManifest.xml"); SW = os.path.join(root, "www", "sw.js"); DL = os.path.join(root, "www", "descargar", "index.html"); WA = os.path.join(root, ".github", "workflows", "android.yml")
M = [
 (H, "el registro deja de indicar la página de confirmación", 'k=="s"?"/auth/v1/signup"+RURLC():', 'k=="s"?"/auth/v1/signup":', "cloud"),
 (H, "el reenvío pierde la espera de 60 s", 'if(Date.now()-last<60000){cmsg=', 'if(false){cmsg=', "cloud"),
 (H, "el reenvío revela errores del servidor (distingue cuentas)", '(!st||st>=500)', '(!st||st>=400)', "cloud"),
 (H, "el cierre de sesión normal revoca TODOS los dispositivos", '"/auth/v1/logout?scope="+(g?"global":"local")', '"/auth/v1/logout?scope=global"', "cloud"),
 (H, "el enlace profundo acepta parámetros", 'x.hostname!=="confirmed"||x.search||x.hash', 'x.hostname!=="confirmed"', "android"),
 (H, "el enlace profundo acepta cualquier host", 'x.hostname!=="confirmed"', 'false', "android"),
 (H, "el enlace profundo acepta otros esquemas", 'if((x.protocol!=="com.bitty.app:"&&x.protocol!=="bitty:")||x.hostname', 'if(x.hostname', "android"),
 (H, "el botón atrás no gestiona la pantalla de contraseña", ' if($("#cN1")){cpwx();return true}', '', "android"),
 (H, "el cambio de contraseña pierde el botón cancelar", 'onclick="cpwx()">${tt("Cancelar"', 'onclick="">${tt("Cancelar"', "cloud"),
 (MF, "el manifiesto declara un App Link https autoverificado", '<data android:scheme="com.bitty.app" android:host="confirmed" />', '<data android:scheme="https" android:host="x.example" /><data android:scheme="com.bitty.app" android:host="confirmed" />', "android"),
 (H, "cambiar la contraseña ya no revoca las sesiones de todos los dispositivos", '/auth/v1/logout?scope=global",{method:"POST"},t)', '/auth/v1/logout?scope=local",{method:"POST"},t)', "cloud"),
 (H, "cambiar la contraseña deja la sesión abierta", 'clearTimeout(ctm);AU=null;MF=null;ME=null;MP=null;asave();AS=1;amode="i";', 'clearTimeout(ctm);MF=null;ME=null;MP=null;asave();AS=1;amode="i";', "cloud"),
 (H, "«cerrar sesión en todos» no pide confirmación", 'if(g&&!confirm(', 'if(false&&!confirm(', "cloud"),
 (H, "«cerrar sesión en todos» solo revoca este dispositivo", '"/auth/v1/logout?scope="+(g?"global":"local")', '"/auth/v1/logout?scope=local"', "cloud"),
 (MF, "el filtro profundo acepta cualquier host", ' android:host="confirmed"', '', "android"),
 (SW, "el service worker guarda URLs con token_hash", 'if (res && res.ok && res.type === "basic" && cacheable(url))', 'if (res && res.ok && res.type === "basic")', "pwa"),
 (SW, "el service worker intercepta Supabase y otros orígenes", 'url.origin !== self.location.origin) return;', 'false) return;', "pwa"),
 (SW, "el service worker guarda respuestas de error", 'res && res.ok && res.type', 'res && res.type', "pwa"),
 (SW, "el service worker no borra las cachés antiguas", 'ks.filter(k => k !== CACHE)', 'ks.filter(k => false)', "pwa"),
 (SW, "sin conexión la página de confirmación se sustituye por la app", '!url.pathname.includes("/auth/")', 'true', "pwa"),
 (SW, "el service worker deja de funcionar sin conexión", 'const hit = await caches.match(req, { ignoreSearch: true });', 'const hit = null;', "pwa"),
 (H, "el service worker se registra también en la app de Android", '!window.Capacitor&&!window.bittyDesktop&&', '!window.bittyDesktop&&', "pwa"),
 (H, "la CSP deja de permitir el service worker", " worker-src 'self';", "", "pwa"),
 (H, "el aviso avisa aunque la versión sea la misma", 'if(n<=cur||', 'if(n<cur||', "update"),
 (H, "el aviso acepta versiones preliminares", '||j.draft||j.prerelease)return;', ')return;', "update"),
 (H, "el aviso acepta cualquier etiqueta", '/^build-(\\d{1,6})$/.exec', '/(\\d+)/.exec', "update"),
 (H, "el enlace del aviso lo decide la API", 'null,UPD.page,()=>', 'null,j.html_url,()=>', "update"),
 (H, "el aviso se muestra también en la web (sin app)", 'A=nat&&Capacitor.Plugins&&Capacitor.Plugins.App;', 'A=Capacitor.Plugins&&Capacitor.Plugins.App;', "update"),
 (H, "el aviso interrumpe un nivel", '||adInLevel()||$("#upd"))return;', '||$("#upd"))return;', "update"),
 (H, "el aviso consulta sin límite de frecuencia", 'if(Date.now()-(+localStorage.getItem("bitty_upd_t")||0)<UPD.every)return;', '', "update"),
 (H, "«Más tarde» no se recuerda", 'localStorage.setItem("bitty_upd_skip",String(n))', '0', "update"),
 (H, "la consulta de versión envía cookies", 'credentials:"omit",referrerPolicy:"no-referrer",signal:c.signal', 'signal:c.signal', "update"),
 (H, "la PWA avisa en la primera instalación", 'navigator.serviceWorker.controller){navigator', 'true){navigator', "update"),
 (DL, "la página de descargas acepta enlaces de cualquier dominio", 'x.browser_download_url.indexOf(OK)===0&&', '', "update"),
 (DL, "la página de descargas ofrece borradores", 'if(!rel||rel.draft||rel.prerelease)return null;', 'if(!rel)return null;', "update"),
 (DL, "la página de descargas inserta HTML de la API", 'a.textContent=t.dl+" "+name;', 'a.innerHTML=t.dl+" "+name+s.tag;', "update"),
 (WA, "el workflow de Android publica sin que lo pidas", "if: ${{ inputs.publish_release }}", "if: ${{ true }}", "update"),
 (WA, "la Release de Android no es «latest»", '--repo "$GITHUB_REPOSITORY" --latest \\\n            --title "Bitty build $RUN_NUMBER (APK de prueba)"', '--repo "$GITHUB_REPOSITORY" \\\n            --title "Bitty build $RUN_NUMBER (APK de prueba)"', "update"),
 (WA, "el versionCode deja de ser el número de ejecución", "BITTY_VERSION_CODE: ${{ github.run_number }}", "BITTY_VERSION_CODE: 1", "update"),
 (H, "falta el icono de iPhone", '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">', '', "pwa"),
]
bad = 0
for path, why, a, b, suite in M:
    orig = open(path, encoding="utf-8", newline="").read()
    if a not in orig:
        print("NO APLICABLE ", why); bad += 1; continue
    open(path, "w", encoding="utf-8", newline="").write(orig.replace(a, b, 1))
    try:
        r = subprocess.run(["node", os.path.join(root, "tests", suite + ".test.js")], capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=root)
    finally:
        open(path, "w", encoding="utf-8", newline="").write(orig)
    print(("DETECTADA   " if r.returncode else "¡SOBREVIVE!  ") + why + "  ->  " + suite)
    bad += 0 if r.returncode else 1
print(f"\n{len(M) - bad}/{len(M)} mutaciones detectadas")
sys.exit(1 if bad else 0)
