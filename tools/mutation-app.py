# Pruebas de mutación de la app (registro, reenvío, cierre de sesión, enlace profundo, contraseña, manifiesto):
# rompe una regla cada vez y comprueba que cloud.test.js o android.test.js falla. Restaura siempre los archivos.
#   python tools/mutation-app.py
import subprocess, os, sys
root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = os.path.join(root, "www", "index.html"); MF = os.path.join(root, "android", "app", "src", "main", "AndroidManifest.xml")
M = [
 (H, "el registro deja de indicar la página de confirmación", 'k=="s"?"/auth/v1/signup"+RURLC():', 'k=="s"?"/auth/v1/signup":', "cloud"),
 (H, "el cierre de sesión vuelve a ser global", '"/auth/v1/logout?scope=local"', '"/auth/v1/logout"', "cloud"),
 (H, "el reenvío pierde la espera de 60 s", 'if(Date.now()-last<60000){cmsg=', 'if(false){cmsg=', "cloud"),
 (H, "el reenvío revela errores del servidor (distingue cuentas)", '(!st||st>=500)', '(!st||st>=400)', "cloud"),
 (H, "el enlace profundo acepta parámetros", 'x.hostname!=="confirmed"||x.search||x.hash', 'x.hostname!=="confirmed"', "android"),
 (H, "el enlace profundo acepta cualquier host", 'x.hostname!=="confirmed"', 'false', "android"),
 (H, "el enlace profundo acepta otros esquemas", 'x.protocol!=="com.bitty.app:"||', '', "android"),
 (H, "el botón atrás no gestiona la pantalla de contraseña", ' if($("#cN1")){cpwx();return true}', '', "android"),
 (H, "el cambio de contraseña pierde el botón cancelar", 'onclick="cpwx()">${tt("Cancelar"', 'onclick="">${tt("Cancelar"', "cloud"),
 (MF, "el manifiesto declara un App Link https autoverificado", '<data android:scheme="com.bitty.app" android:host="confirmed" />', '<data android:scheme="https" android:host="x.example" /><data android:scheme="com.bitty.app" android:host="confirmed" />', "android"),
 (MF, "el filtro profundo acepta cualquier host", ' android:host="confirmed"', '', "android"),
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
