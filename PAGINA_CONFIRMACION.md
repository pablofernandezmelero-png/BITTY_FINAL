# Página pública de confirmación de correo

Dirección: **`https://pablofernandezmelero-png.github.io/BITTY_FINAL/auth/confirm/`**
Archivo: `www/auth/confirm/index.html` (se publica con la web; funciona sin la app instalada).

> **Estado:** implementada y probada con un Supabase **simulado** (57 pruebas + 13 mutaciones) y en un **navegador real** contra el Supabase **real** para el camino de error (un `token_hash` inventado devuelve 403 y la página muestra «Este enlace ya no es válido»). **No se ha probado el camino de éxito con un correo real**: depende de que apliques la configuración de abajo. Ver «Cómo probarla».

## Cómo funciona

1. El usuario se registra. Supabase envía el correo «Confirm signup» (con tu plantilla, ver abajo) con un enlace a esta página: `…/auth/confirm/?token_hash=XXXX&type=email`.
2. La página lee `token_hash` y `type` **una sola vez** y los **borra de la barra de direcciones** (no quedan en el historial).
3. Llama al flujo oficial de Supabase Auth: `POST /auth/v1/verify` con `{type, token_hash}` (equivale a `supabase.auth.verifyOtp({ token_hash, type })`).
4. Si Supabase acepta, muestra «¡Correo confirmado!». **No inicia sesión aquí**: la sesión que devuelve Supabase se **revoca** al instante (solo en ese dispositivo) y no se guarda nada. El usuario inicia sesión en Bitty con su contraseña.
5. Botón «Volver a Bitty»: en **web/PC** lleva a la web de Bitty; en **Android** intenta abrir la app con `com.bitty.app://confirmed` y, si no está instalada (la página sigue visible a los 1,6 s), vuelve a la web; en **PC** ofrece además un enlace para abrir la app de escritorio con `bitty://confirmed`.

## Estados

| Estado | Cuándo | Mensaje | Acciones |
|---|---|---|---|
| Verificando | Al cargar con parámetros válidos | «Verificando tu correo…» (animación) | — |
| Confirmado | Supabase responde 200 | «¡Correo confirmado! Tu cuenta está verificada. Ya puedes iniciar sesión.» | «Volver a Bitty» (+ app de escritorio en PC) |
| Caducado o ya usado | 403 `otp_expired` (Supabase **no distingue** inválido, caducado y usado) | «Este enlace ya no es válido… Si ya confirmaste tu correo, abre Bitty e inicia sesión» | Pedir enlace nuevo (formulario) · volver |
| Enlace no válido | Faltan parámetros, formato incorrecto, tipo no permitido o 400/422 | «Enlace no válido» | Pedir enlace nuevo · volver |
| Error de servidor | 5xx, 429 o sin conexión | «No hemos podido verificar el correo» | «Reintentar» (mismo enlace) · volver |

Recargar la página tras confirmar vuelve a mostrar «confirmado» (se recuerda solo en esa pestaña, sin datos).

Idiomas: español (por defecto), inglés y neerlandés; por el idioma del navegador o con `?lang=en|nl` (lista blanca). Modo claro y oscuro, «reducir movimiento», foco visible y anuncio `aria-live`.

## Reenvío del enlace

Formulario con el correo → `POST /auth/v1/resend {type:"signup", email}` con `redirect_to` a esta misma página. Para evitar abusos y la enumeración de cuentas:

- La respuesta es **siempre la misma** exista o no la cuenta («Si existe una cuenta pendiente de confirmar con ese correo, te hemos enviado un enlace nuevo»), también ante errores 4xx.
- **Espera mínima de 60 s** entre envíos en el cliente; Supabase aplica además su propio límite (429 → «Espera un poco…»).
- El mismo botón aparece en la pantalla de acceso de la app cuando el inicio de sesión falla por «correo no confirmado».

## Correcciones razonadas respecto al plan (`Resumen Ejecutivo.pdf`)

| El plan decía | Lo implementado y por qué |
|---|---|
| Enlace `…/auth/confirm?token={{ .Token }}&type=signup` | `…/auth/confirm/?token_hash={{ .TokenHash }}&type=email`. `{{ .Token }}` es el **código de 6 dígitos** y no se puede verificar sin el correo; el flujo oficial seguro usa `token_hash`. El tipo `signup` también se acepta |
| `auth.api.verifyOTP(...)` | Es la API antigua (v1). Se usa el endpoint actual `POST /auth/v1/verify` (equivalente a `verifyOtp`) |
| `SITE_URL = https://bitty.app/auth/confirm` | **Site URL es la dirección base** (`https://pablofernandezmelero-png.github.io/BITTY_FINAL`); la ruta de confirmación va en el enlace de la plantilla y en las Redirect URLs |
| Dominio `bitty.app` | Hoy **no hay dominio propio**: la web vive en `github.io`. Todo está preparado para cambiarlo (ver «Dominio propio») |
| Android App Links (`<intent-filter autoVerify>` con el dominio) | **No es posible en `github.io`**: exige `https://<dominio>/.well-known/assetlinks.json` en la **raíz del dominio**, y una página de proyecto de GitHub Pages vive en `/BITTY_FINAL/`. Se usa un enlace profundo con esquema propio `com.bitty.app://confirmed` (solo avisa, sin tokens). Con dominio propio se puede pasar a App Links |
| Fallback SPA con `404.html` | No hace falta: `/auth/confirm/` es una **carpeta real** con su `index.html` |
| Esquemas de la app en las Redirect URLs de Supabase | No son necesarios: el correo apunta a la página https; los esquemas propios solo los abre el botón de la página |

## Qué tienes que configurar tú en Supabase (no se puede hacer desde el código)

1. **Authentication → URL Configuration**
   - *Site URL*: `https://pablofernandezmelero-png.github.io/BITTY_FINAL` (**sin barra final**)
   - *Redirect URLs*: `https://pablofernandezmelero-png.github.io/BITTY_FINAL/**`
2. **Authentication → Email Templates → Confirm signup**
   - *Subject*: `Confirma tu correo en Bitty`
   - *Message (HTML)*:

   ```html
   <h2>¡Bienvenido a Bitty!</h2>
   <p>Pulsa el botón para confirmar tu correo y activar tu cuenta.</p>
   <p><a href="{{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&type=email"
         style="display:inline-block;padding:12px 22px;background:#6d4aff;color:#ffffff;
                border-radius:12px;text-decoration:none;font-weight:bold">Confirmar mi correo</a></p>
   <p>Si el botón no funciona, copia esta dirección en tu navegador:<br>
      {{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&type=email</p>
   <p>Si no has creado una cuenta en Bitty, puedes ignorar este mensaje.</p>
   ```

   Las demás plantillas (recuperar contraseña, enlace mágico) **se dejan como están**: la app ya gestiona esos enlaces.
3. **Authentication → Providers → Email**: confirmación de correo **activada** (hoy lo está).
4. Recomendado: **SMTP propio** (*Project Settings → Authentication → SMTP*); el correo por defecto de Supabase tiene un límite bajo de envíos por hora.

## Seguridad de la página

- **El token no se filtra**: se borra de la URL, `<meta name="referrer" content="no-referrer">`, `credentials: omit`, y la página no carga ningún recurso externo (ni fuentes).
- **Sin sesión**: la sesión devuelta se revoca (`logout?scope=local`) y no se guarda ningún token (ni en el almacenamiento ni en el HTML).
- **Parámetros validados**: `token_hash` con formato estricto y `type` de una lista blanca (`email`, `signup`, `email_change`). Un tipo de recuperación o enlace mágico se rechaza **sin llamar a Supabase**.
- **Sin XSS**: todo el texto se inserta con `textContent`; nada de `innerHTML`. Probado con parámetros que contienen HTML.
- **Sin redirecciones abiertas**: «Volver a Bitty» solo va a constantes (la web de Bitty o los esquemas propios); nunca a un destino que venga de la URL.
- **CSP restrictiva** (`connect-src` solo al proyecto de Supabase).
- **Escáneres de correo**: el enlace solo se consume cuando la página ejecuta JavaScript y llama a Supabase, así que un escáner que hace un simple GET no gasta el token (a diferencia del enlace de verificación directo de Supabase).

## Dominio propio (opcional, para publicar de verdad)

Si compras un dominio (p. ej. `bitty.app`): configúralo en *Settings → Pages* del repositorio (crea el archivo `CNAME`), activa HTTPS y cambia **la misma dirección** en estos sitios: `WEB` en `www/index.html`, `WEB`/`WEB_CONFIRM` en `www/auth/confirm/index.html`, `EXTERNAL_ALLOW` en `desktop/security.js`, los tests que la citan, y en Supabase *Site URL* y *Redirect URLs*. Con dominio en la raíz podrás publicar `/.well-known/assetlinks.json` (con el SHA-256 de tu keystore de release) y sustituir el enlace profundo por **Android App Links** (`https` + `android:autoVerify="true"`).

## Alojamiento: GitHub Pages, Netlify o Vercel

| | GitHub Pages | Netlify | Vercel |
|---|---|---|---|
| Tipo | Estático (HTML/CSS/JS) | Estático + funciones | Estático + funciones |
| HTTPS | Sí | Sí | Sí |
| Funciones de servidor / variables secretas | **No** | Sí | Sí |
| Despliegue | Con Actions (ya configurado: `pages.yml`) | Desde Git | Desde Git |
| Dominio propio | Sí (`CNAME`) | Sí | Sí |
| Coste | Gratis (límites de uso razonable documentados por GitHub; compruébalos en su documentación actual) | Plan gratuito | Plan gratuito |

**Recomendación:** quedarse en **GitHub Pages**. Bitty es una web estática que habla directamente con Supabase, y toda la lógica sensible vive en Supabase (funciones SQL con RLS), así que no necesita funciones de servidor ni variables secretas en el alojamiento. Netlify o Vercel solo compensarían si algún día se añaden *Edge Functions*/funciones propias o redirecciones avanzadas. Cambiar es sencillo (es una carpeta estática) siempre que se actualicen las direcciones de la sección anterior.

## Cómo probarla (lo haces tú, con una cuenta real)

1. Aplica la configuración de arriba (puntos 1 y 2).
2. En la web publicada, **crea una cuenta** con un correo tuyo. Anota si llega el correo y si el botón apunta a `…github.io/BITTY_FINAL/auth/confirm/?token_hash=…` (no a `localhost`).
3. Pulsa el botón: debe verse «¡Correo confirmado!». Después, en Bitty, inicia sesión.
4. **Segundo clic en el mismo enlace** (o recarga con el enlace copiado): debe verse «Este enlace ya no es válido».
5. Pide otra confirmación desde el aviso de la pantalla de acceso y comprueba que llega el nuevo correo y que un segundo reenvío inmediato se bloquea.
6. En Android (APK nueva): abre el enlace del correo y pulsa «Volver a Bitty»; debe abrir la app y mostrar «¡Correo confirmado!». Con la app desinstalada debe llevar a la web.
7. Dime el resultado de cada punto y lo dejo registrado como **verificado con servicios reales**.
