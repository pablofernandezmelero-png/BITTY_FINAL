# Pruebas de mutación de la página de confirmación: rompe una regla de privacidad/seguridad cada vez y comprueba que tests/confirm.test.js falla.
#   python tools/mutation-confirm.py
import subprocess, os, sys
root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, "www", "auth", "confirm", "index.html"), encoding="utf-8", newline="").read()
tmp = os.environ["TEMP"]
M = [
 ("el token se queda en la dirección", 'try{history.replaceState(null,"",location.pathname+(qs.get("lang")?"?lang="+L:""))}catch(e){}', ''),
 ("se guarda la sesión que devuelve Supabase", 'if(j&&j.access_token)post(', 'if(j&&j.access_token)localStorage.setItem("bitty_auth",j.access_token);if(j&&j.access_token)post('),
 ("no se revoca la sesión", 'if(j&&j.access_token)post("/auth/v1/logout?scope=local",{},{Authorization:"Bearer "+j.access_token}).catch(function(){});', ''),
 ("se admite el tipo recovery", 'var TYPES={email:1,signup:1,email_change:1};', 'var TYPES={email:1,signup:1,email_change:1,recovery:1};'),
 ("el reenvío revela si la cuenta existe", 'else msg.textContent=T.rok;', 'else if(r.status>=400)msg.textContent="Ese correo no está registrado.";else msg.textContent=T.rok;'),
 ("sin espera entre reenvíos", 'if(Date.now()-last<60000){msg.textContent=T.rwait;return}', ''),
 ("se usa innerHTML con el mensaje", '$m.textContent=T[S[1]];', '$m.innerHTML=T[S[1]];'),
 ("se carga una fuente externa", '<style>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka"><style>'),
 ("se envían cookies", 'credentials:"omit"', 'credentials:"include"'),
 ("sin Referer controlado en la página", '<meta name="referrer" content="no-referrer">', ''),
 ("connect-src abierto", "connect-src https://tewlouwqlpjmrifvhrhz.supabase.co;", "connect-src *;"),
 ("se llama a verify sin validar los parámetros", 'if(validParams)verify();', 'verify();'),
 ("un enlace caducado se muestra como éxito", 'if(r.status===403||r.status===401||r.status===404||(j&&j.error_code==="otp_expired"))return show("expired");', 'if(r.status===403)return show("ok");'),
]
dead = 0
for name, a, b in M:
    assert a in src, name
    p = os.path.join(tmp, "mut_confirm.html")
    open(p, "w", encoding="utf-8", newline="").write(src.replace(a, b, 1))
    r = subprocess.run(["node", os.path.join(root, "tests", "confirm.test.js"), p], capture_output=True, text=True)
    print(("DETECTADA   " if r.returncode else "¡SOBREVIVE!  ") + name)
    dead += 0 if r.returncode else 1
print(f"\n{len(M) - dead}/{len(M)} mutaciones detectadas")
sys.exit(1 if dead else 0)
