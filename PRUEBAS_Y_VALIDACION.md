# Pruebas y validación

Se ejecutan todas con `npm test` (y las ejecutan automáticamente los workflows antes de compilar o publicar). Si cualquiera falla, el comando termina con error.

## Niveles de validación

| Nivel | Qué demuestra | Qué NO demuestra |
|---|---|---|
| **Mock** (servidor simulado en jsdom) | La lógica del cliente: pantallas, peticiones que envía, manejo de respuestas | Que Supabase real responda igual |
| **PostgreSQL embebido (PGlite 18)** | SQL real: RLS, permisos, funciones, restricciones, idempotencia | GoTrue, correo, MFA real, red, límites de la plataforma |
| **Servicio real (Supabase)** | Comportamiento real de la plataforma | — |
| **Android físico** | La app en un móvil | — |

## Suites (resultado del 2026-11-05; `npm test` termina con código 0)

| Archivo | Nivel | Resultado | Qué cubre |
|---|---|---|---|
| `tests/static.test.js` | Análisis estático (parser acorn) | 12/12 | Sin `eval`/`document.write`, 276 traducciones con los 3 idiomas, 0 código muerto, manejadores de la interfaz definidos (sin botones rotos), CSP restrictiva, solo clave pública en el cliente, accesibilidad básica |
| `tests/questions.test.js` | Local (jsdom) | 12.780 preguntas generadas, 0 errores | Todas las rutas × 3 dificultades × 3 idiomas: sin vacías, sin `NaN`/`undefined`, sin opciones repetidas |
| `tests/bank.test.js` | Local | 1.213/1.213 | 0 duplicados ni casi duplicados, 3 idiomas, **18 respuestas verificadas ejecutando el código**, anti-repetición por antigüedad |
| `tests/flow.test.js` | Local (jsdom) | 42 pasos | Jugar niveles y jefes ganando en 3 idiomas × 3 dificultades × 4 rutas |
| `tests/cloud.test.js` | **Mock** | 70/70 | Registro (con redirección a `/auth/confirm/`), login, cuenta sin confirmar y reenvío, logout local, recuperación, enlace mágico, invitado, fusión, cola de XP, 2FA completo (TOTP RFC 6238 real), **cambiar contraseña desde el Perfil**, recorte del historial, eliminar cuenta, rechazos por tope |
| `tests/confirm.test.js` | **Mock** (respuestas de Supabase simuladas con las reales observadas) | 57/57 | **Página `/auth/confirm/`**: cada estado, token borrado de la URL, sesión devuelta revocada y nunca guardada, reenvío sin enumeración y con espera, tipos y parámetros hostiles, Android/PC, 3 idiomas, CSP, sin recursos externos |
| `tests/robustness.test.js` | **Mock** | 41/41 | Estado corrupto o antiguo, almacenamiento ausente o lleno, contenido hostil, sesión caducada, servidor 500 y sin red, reinicio con eventos pendientes, enlace con token de otra cuenta, reinicio de progreso, nodos del mapa accesibles, **`bitty://confirmed` por el puente del escritorio** |
| `tests/monkey.test.js` | Local (jsdom) | 10/10 · **6.000 acciones aleatorias** | 5 semillas fijas, controles visibles y texto, sin red: sin excepciones ni estados absurdos |
| `tests/sql.test.js` | **PGlite** | 100/100 | RLS entre usuarios, XP (validación, referencias, retos, topes de 24 h, repeticiones y anuncios, ritmo, racha, idempotencia), AAL1/AAL2, `activity_log`, `question_history`, `delete_my_account`, cascada |
| `tests/migrations.test.js` | **PGlite** | 38/38 | Las 8 migraciones desde cero y **dos veces**; sobre una estructura equivalente a producción con datos; auditoría del catálogo (RLS, `search_path`, privilegios, vistas, claves ajenas, AAL2) |
| `tests/content.test.js` | **PGlite** | 44/44 | 1.144 preguntas y 212 lecciones, idempotencia, coincidencia con la app, permisos |
| `tests/android.test.js` | **Mock** (Capacitor y AdMob simulados) | 45/45 | Botón atrás, aviso sin conexión, anuncios, **enlace profundo `com.bitty.app://confirmed`** (y 7 enlaces hostiles ignorados), **manifiesto** (un único filtro `BROWSABLE`, sin App Links ni `autoVerify`) |
| `tests/desktop.test.js` | Local (Node, sin Electron) | 100/100 | Rutas hostiles contra `app://bitty`, navegación y enlaces externos, enlace profundo `bitty://confirmed`, configuración endurecida de `main.js`/`preload.js`/`package.json` |
| `desktop/scripts/smoke.js` | **Binario real (Electron 45.2.3)** | 10/10 | Arranca la app de escritorio (y la **empaquetada**) con ventana oculta: sin `require`/`process`, API mínima, `localStorage`, modo invitado, navegación externa bloqueada, intentos de salirse de `www` rechazados. **No forma parte de `npm test`** (necesita Electron); lo ejecuta el workflow de Windows |

**Total en `npm test` (recuento del 6 de noviembre de 2026): 2.007 comprobaciones explícitas**, sin contar las 12.780 preguntas generadas ni las 6.000 acciones aleatorias: static 12, bank 1.213, confirm 57, robustness 41, monkey 10, sql 100, migrations 38, content 44, desktop 116, pwa 57, update 91, privacy 46, flow 42, cloud 77, android 63. Mutaciones: app 64/64 (incluye las de PWA, actualización, banner, privacidad y workflows), escritorio 22/22, SQL 23/23, confirmación 13/13. Más `desktop/scripts/smoke.js` con Electron real (11/11, no entra en `npm test`).

**Qué tipo de prueba es cada cosa:** jsdom y simuladores (la mayoría), PostgreSQL embebido (SQL y migraciones), **Electron real** (arranque, aislamiento, versión por IPC), **Chromium real** (PWA y service worker, página de descargas en vivo, medición de la barra inferior) y **un Android real emulado** (API 36: instalación de la APK firmada, arranque, consentimiento, banner; ver `VALIDACION_ANDROID_EMULADOR.md`). **Nada se ha probado en un móvil físico, en un iPhone, ni con un correo/Supabase real.**

## Pruebas de mutación (los tests detectan errores introducidos a propósito)

Se rompe **una regla cada vez**, se comprueba que algún test falla y se restaura el archivo. **79 mutaciones, 79 detectadas** (varias sobrevivieron la primera vez: eran huecos de las pruebas y se cubrieron).

| Herramienta | Reglas rotas | Resultado |
|---|---|---|
| `tools/mutation-sql.js` | 23 de seguridad SQL (topes, referencias, AAL2, `search_path`, privilegios, `security_invoker`, borrado de cuentas…) | 23/23 |
| `tools/mutation-confirm.py` | 13 de la página de confirmación (token en la URL, sesión guardada o no revocada, tipo `recovery`, enumeración, sin espera, `innerHTML`, recurso externo, cookies, CSP, éxito falso…) | 13/13 |
| `tools/mutation-app.py` | 11 de la app (registro sin redirección, logout global, reenvío sin espera o que distingue cuentas, enlace profundo con parámetros/otro host/otro esquema, atrás en contraseña, cancelar, manifiesto con App Link o host abierto) | 11/11 |
| `tools/mutation-desktop.py` | 20 de Electron (salida de `www`, web externa, `http`, enlace profundo, URL parecida, credenciales, aislamiento, Node, sandbox, `webview`, navegación, permisos, DevTools, registro de protocolo, menú, preload, Electron 39, protocolo del instalador) | 20/20 |
| Manual / `static.test.js` | 7 del análisis estático + 5 del cliente (cuota llena, `home()` sin ruta, confirmación de cambio de cuenta, reinicio con cuenta, cola ante un tope) | 12/12 |

### Defectos de las propias pruebas encontrados por las mutaciones

- **Aserciones vacías (importante):** `T()` leía `document.body.textContent`, y el `<body>` incluye el código del `<script>`, que contiene **todos los textos de la interfaz**. Cualquier comprobación «aparece este texto» pasaba siempre. Además jsdom arranca la app en inglés mientras los tests esperaban español. **Corregido:** `T()` lee solo el texto visible (app, aviso y banner sin conexión) y el idioma del navegador simulado es español. Al corregirlo salieron a la luz y se arreglaron 2 fallos reales (el reenvío no distinguía un 5xx cuando el servidor manda un mensaje, y un escenario sin modo invitado).
- **Argumentos invertidos:** en `android.test.js` `ok(nombre, condición)` va al revés que en el resto; 3 comprobaciones del manifiesto pasaban siempre. Corregido.
- **Casos que faltaban:** error 4xx en el reenvío, botón «Cancelar» probado con un clic real y no llamando a la función.

## Contra el servicio real (Supabase) — lo único comprobado

Con la clave pública, sin crear cuentas ni escribir datos:

- La API responde y el registro por correo está habilitado (Google, Apple, etc. desactivados).
- `progress`, `profiles` y `stats` existen; un usuario **anónimo** lee `[]` y sus escrituras se rechazan con `42501` (RLS).
- Las tablas/funciones de las migraciones 003–007 **no existen** todavía (404).

## GitHub Actions (real)

- `Build Android APK` #3, commit `3d2d97e`: éxito (tests, `cap sync`, compilación, APK de 8,56 MB).
- `Publicar web (GitHub Pages)`: éxito; la web publicada es byte a byte la del repositorio (mismo SHA-256).
- `Build Android Release (firmado)`: **no ejecutado** (faltan secretos).

## Escaneos

- `npm audit`: 0 vulnerabilidades.
- Búsqueda de secretos en lo que se sube (claves `service_role`/`secret`, claves privadas, tokens de GitHub, contraseñas literales): limpio; solo aparece la clave pública `sb_publishable_…`, pública por diseño, y datos de prueba falsos.

## Pendiente (no realizado)

- Todo contra Supabase real con sesión: registro, correo, login, recuperación, sincronización, 2FA, `award_xp`. Procedimiento en `CONFIGURACION_SUPABASE.md`, sección 4.
- Todo en Android físico (lista en `COMPILACION_ANDROID.md`).
- Rendimiento y memoria en dispositivo.
- Prueba de carga/conexión lenta real (solo simulada: reintentos y cola).
- **Pruebas visuales**: los tests de interfaz usan jsdom, que no dibuja, así que **ningún test automático comprueba el aspecto**. En la auditoría se revisaron a mano, en un navegador real a 375×812 y en claro/oscuro, solo 6 pantallas (bienvenida, nombre, elegir ruta, mapa, pregunta y acierto). **No se vieron en pantalla**: Perfil, Especiales, retos, 2FA ni anuncios, ni otros anchos de pantalla.
- Lector de pantalla real (TalkBack) y contraste medido en todos los estados.
- Sondeo de memoria y arranque en un móvil modesto (solo se midió en escritorio).
- Cambio real de dispositivo, y expiración real de sesión.

## Cómo repetirlo

```bash
npm ci
npm test
node tools/build-questions.js --check     # el HTML coincide con content/questions-extra.js
node tools/export-content.js --check      # la migración 006 coincide con la app
```
