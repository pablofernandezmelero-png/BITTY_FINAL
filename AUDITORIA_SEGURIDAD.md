# Auditoría de seguridad

Fecha: 2026-11-04. Alcance: código web, SQL, Android/Capacitor, dependencias, CI y configuración. **No se hicieron pruebas destructivas contra servicios reales**: las únicas peticiones a Supabase real fueron lecturas y un intento de escritura anónima (rechazado por RLS) con la clave pública. Todo lo demás se reproduce en local (PostgreSQL embebido, jsdom).

Gravedades: CRÍTICO · ALTO · MEDIO · BAJO · INFORMATIVO.

## Resumen

- **Críticos: 0.**
- **Altos: 1 abierto en producción** (XP escribible por el cliente hasta aplicar la migración 004) y 2 detectados y corregidos antes de aplicarse (tope diario por fecha del cliente, referencias libres).
- Medios, bajos e informativos: ver tablas. Todo lo que se podía corregir en local está corregido y cubierto por una prueba que **falla si se revierte el arreglo** (pruebas de mutación: 35 mutaciones, 35 detectadas).
- **Nada se ha comprobado con la seguridad de Supabase real** más allá de RLS para el usuario anónimo.

## A. Abiertos

| # | Gravedad | Hallazgo | Impacto | Cómo se descubrió / reproducir (seguro) | Estado |
|---|---|---|---|---|---|
| S1 | **ALTO** | Con la migración 004 sin aplicar, el cliente puede escribir su propio XP y estadísticas en producción | Ranking/XP falsificable por cualquier usuario con sesión | Revisión de políticas de `stats` (002: insert/update propios). Reproducción: `npm test` → `sql.test.js` muestra que tras la 004 la escritura se rechaza; en producción la 004 no existe (`rpc/award_xp` → 404) | **Abierto** hasta aplicar la 004. Solución escrita y probada |
| S2 | MEDIO | `Site URL` de Supabase posiblemente en `localhost` | Enlaces de confirmación/recuperación rotos (no es una brecha, pero rompe el flujo de cuentas) | Observado en la captura del panel durante el proyecto; no verificable desde fuera | **Abierto** (acción del propietario) |
| S3 | MEDIO | Google Fonts se carga desde servidores de Google sin consentimiento | Envío de la IP del usuario a un tercero; riesgo RGPD; falla offline (cae a fuentes del sistema) | Revisión de recursos externos del HTML: únicamente `fonts.googleapis.com` y `fonts.gstatic.com` | **Abierto**: autoalojar las fuentes (requiere descargarlas) |
| S4 | MEDIO | Sin límite de intentos de inicio de sesión ni política de contraseñas verificados en servidor | Fuerza bruta / contraseñas débiles (solo el cliente exige 8 caracteres) | No verificable sin el panel | **Abierto** (acción del propietario) |
| S5 | MEDIO | Sesión y token de renovación en `localStorage` de la app | Lectura por quien tenga acceso al almacenamiento de la app (dispositivo con root) | Revisión: claves `bitty_auth`, sin cifrado del sistema | Mitigado: `allowBackup=false`, sin copias ni transferencia. Un almacén cifrado exige un plugin nativo adicional |
| S6 | BAJO | Flujo implícito de Supabase con `#access_token` en la URL (sin PKCE) | Un enlace manipulado puede iniciar sesión con la cuenta de otra persona | Revisión del flujo; ver C7 | Mitigado por C7 (confirmación previa); PKCE sería la solución completa |
| S7 | BAJO | `import_legacy_stats` confía en el cliente una vez por cuenta (≤ 20.000 XP) | XP inicial inflable una vez | Diseño: el servidor no ve lo jugado como invitado | Aceptado y documentado |
| S8 | BAJO | El servidor no puede saber si realmente se jugó un nivel | Un tramposo puede enviar eventos válidos (acotado a 3.000 XP/24 h, una vez por nivel y dificultad) | Diseño | Aceptado y documentado |
| S9 | BAJO | La racha dentro de `progress.data` la escribe el cliente; la protegida es `stats.streak` | Racha visual falsificable | Revisión | Aceptado y documentado |
| S10 | BAJO | `delete_my_account()` no pide la contraseña de nuevo | Una sesión robada (y su 2.º factor, si lo hay) puede borrar la cuenta | Revisión de la función | Aceptado: la doble confirmación del cliente no es una medida de seguridad |
| S11 | BAJO | Al cambiar de cuenta sin conexión se pierden los eventos de XP pendientes de la anterior | Pérdida de XP no sincronizado | Revisión de `creset()` | **Abierto** (poco probable) |
| S12 | BAJO | `script-src 'unsafe-inline'` en la CSP | Inevitable con un único HTML con código en línea | Revisión de la CSP | Aceptado |
| S13 | INFO | Las respuestas correctas son legibles públicamente (tablas de contenido y propio HTML) | Ninguno: ya viajan dentro de la app | Diseño | Aceptado |
| S14 | INFO | `minifyEnabled false` en release | El código web es visible de todos modos | `build.gradle` | Aceptado |
| S15 | INFO | `handle_new_user()` conserva el permiso `EXECUTE` por defecto | No es invocable como API (devuelve `trigger`) | Auditoría del catálogo | Aceptado |

## B. Detectados y corregidos

| # | Gravedad | Hallazgo | Cómo se descubrió | Reproducción segura | Corrección y prueba |
|---|---|---|---|---|---|
| C1 | **ALTO** | Tope diario de XP medido con la fecha que envía el cliente: usando ayer, hoy y mañana se triplicaba | Lectura crítica de `award_xp` | `sql.test.js`: 2.990 XP repartidos en 3 fechas y un 10 más con otra fecha | Ventana de 24 h con la hora del servidor. Mutación detectada |
| C2 | **ALTO** | Referencias de recompensa libres: se podían inventar para cobrar XP sin fin | Idem | `sql.test.js`: `lv:x:1`, `lv:g:1:100`, etc. | Formato fijo por tipo; retos con fecha y XP según dificultad. 2 mutaciones detectadas |
| C3 | MEDIO | Sin tope propio de repeticiones ni de anuncios (se evadía cambiando el día) | Idem | `sql.test.js` | 500 XP/24 h y 3 anuncios/24 h |
| C4 | MEDIO | Llamadas simultáneas podían saltarse el ritmo; `import_legacy_stats` podía sobrescribirse | Idem | No reproducible con una sola conexión | Bloqueo por usuario y guarda en el `on conflict` |
| C5 | MEDIO | Repetir la migración 004 falseaba `base_xp` de cuentas nuevas | Prueba de doble ejecución | `migrations.test.js` | Guarda de eventos. Mutación detectada |
| C6 | MEDIO | `progress` y `profiles` con privilegios por defecto sobrantes (`anon` con todo, `TRUNCATE` para `authenticated`; `TRUNCATE` no pasa por RLS) | Auditoría automática del catálogo | `migrations.test.js` (privilegios mínimos) | Recortados en la 003. 2 mutaciones detectadas |
| C7 | MEDIO | Un inicio de sesión por enlace (`#access_token`) sustituía o fusionaba el progreso local con otra cuenta **sin avisar** | Revisión del flujo de enlaces | `robustness.test.js` (enlace de otra cuenta con progreso local) | Confirmación explícita; token borrado de la URL. Mutación detectada |
| C8 | MEDIO | El guardado local fallaba **en silencio** con la cuota llena y se perdía el progreso nuevo | Medición del tamaño del estado (≈ 5 MB con historial máximo) | `robustness.test.js` con cuota simulada: sin el arreglo, el estado guardado se queda en el antiguo | Recorte del historial más antiguo y reintento. Mutación detectada |
| C9 | MEDIO | Los rechazos permanentes del servidor (`replay_cap`, `ad_cap`) bloqueaban toda la cola de XP | Revisión cruzada servidor↔cliente | `cloud.test.js` | Se descartan esos eventos. Mutación detectada |
| C10 | MEDIO | «Borrar todo tu progreso» con cuenta dejaba XP del servidor y niveles borrados (progreso incoherente) | Revisión del botón y de la fusión | `robustness.test.js` | Con cuenta lo explica y remite a «Eliminar cuenta». Mutación detectada |
| C11 | MEDIO | Excepción (`Cannot read properties of undefined`) con la ruta sin elegir: Perfil → Borrar progreso → botón atrás | Prueba de pulsaciones aleatorias | `robustness.test.js` | `home()` vuelve a la elección de ruta. Mutación detectada |
| C12 | BAJO | `FileProvider` con `external-path` en todo el almacenamiento externo | Revisión de `file_paths.xml` | Lectura del archivo | Reducido a la caché (ningún plugin instalado emite URIs) |
| C13 | MEDIO | Bug de cliente: el campo del código 2FA se vaciaba antes de enviarse | Pruebas del 2FA (sesión anterior) | `cloud.test.js` | Código leído antes de repintar |
| C14 | INFO | Vista `activity_log` filtraba datos de otros usuarios sin `security_invoker` | Mutación (sesión anterior) | `sql.test.js` | `security_invoker = true` |

## B2. Detectados y corregidos en la fase del plan maestro (2026-11-05)

| # | Gravedad | Hallazgo | Cómo se descubrió | Corrección y prueba |
|---|---|---|---|---|
| C15 | **ALTO** | **Electron 39.x**: avisos de seguridad de gravedad alta (herencia de restricciones de *sandbox* en ventanas emergentes, lecturas entre orígenes en manejadores de protocolo, permisos atribuidos al origen equivocado, `extract-zip`) | `npm audit` sobre el proyecto de escritorio | Subida a **Electron 45.2.3** (0 altas) y comprobación con Electron real. Exposición real baja en Bitty (sin popups ni `webview`, protocolo propio) |
| C16 | MEDIO | El enlace de confirmación del plan (`token={{ .Token }}`) es el código de 6 cifras: no se puede verificar sin el correo y obligaría a pedirlo o a usar la API antigua | Revisión del plan frente a la documentación de Supabase | Flujo oficial con `token_hash` (`PAGINA_CONFIRMACION.md`) |
| C17 | MEDIO | Aserciones **vacías** en las propias pruebas: leían `body.textContent`, que incluye el código del script con todos los textos de la interfaz, y pasaban siempre | Una mutación sobrevivió | `T()` lee solo el texto visible; idioma español fijado; 2 fallos reales salieron a la luz y se corrigieron |
| C18 | BAJO | `sbf` perdía el estado HTTP del error: el reenvío no distinguía un 5xx de un 4xx cuando el servidor manda mensaje | Prueba del reenvío con texto visible real | El error conserva `status`; 4xx → respuesta genérica (sin enumeración), 5xx/red → «No se pudo enviar» |
| C19 | BAJO | El cierre de sesión era **global** (revoca todos los dispositivos) | Revisión de `/auth/v1/logout` | `?scope=local` |

Nuevas protecciones verificadas: la página de confirmación **no guarda ni deja viva ninguna sesión**, no filtra el token (se borra de la URL, `no-referrer`, sin recursos externos), valida parámetros con lista blanca y no puede ser usada para redirigir a otro sitio.

**CSRF y orígenes (revisión del plan):** la API se usa con `Authorization: Bearer` (no cookies), así que CSRF no aplica; Supabase responde `Access-Control-Allow-Origin: *` por diseño (comprobado con una petición real), de modo que la protección es el token y RLS, no el origen.

## C. Comprobado y sin hallazgos

| Revisión | Resultado |
|---|---|
| **XSS** | Todo texto externo (errores del servidor, correo, nombre de dispositivo 2FA, nombre guardado) se escapa con `esc()` o se sanea al cargar. 6 usos de `innerHTML`, todos con datos escapados. Probado con nombres y mensajes que contienen HTML (`robustness.test.js`) |
| **Inyección SQL** | Cliente solo por REST/PostgREST (parametrizado). En SQL, las funciones usan parámetros tipados y regex fijas; `search_path` vacío en las 6 funciones `SECURITY DEFINER` (comprobado por catálogo) |
| **Ejecución dinámica** | 0 `eval`, `new Function`, `document.write` ni `setTimeout` con cadena en el código (análisis con parser) |
| **Secretos** | El cliente solo contiene la clave pública `sb_publishable_…`; ninguna `service_role`/`secret`/JWT. Escaneo del historial subido: limpio. `*.jks` y `*.keystore` ignorados |
| **Dependencias** | `npm audit`: 0 vulnerabilidades |
| **CSP** | `default-src 'none'`, `object-src`/`base-uri`/`form-action` `'none'`, `connect-src` solo `https://*.supabase.co`, sin orígenes externos en `script-src`, imágenes solo `data:`/`blob:` |
| **Registros** | Ninguna llamada a `console.*` con datos de usuario ni tokens (solo 4 `console.error` de validación de los bancos de preguntas, sin datos de usuario) |
| **CORS / redirecciones** | La URL de retorno de los correos es una constante o el origen web; sin parámetros de redirección controlables |
| **RLS** (SQL) | Todas las tablas con RLS; ninguna política de escritura para `anon`; políticas restrictivas de AAL2 en todas las tablas privadas; vistas con `security_invoker`; claves ajenas con cascada |
| **Android** | `allowBackup=false` + reglas de extracción, `usesCleartextTraffic=false`, sin *deep links*, `MainActivity` sin código propio, `exported` solo en la actividad de lanzamiento, `FileProvider` no exportado. Permisos propios: solo `INTERNET`; el plugin de anuncios añade `ACCESS_NETWORK_STATE` y el SDK sus propios permisos (no se pudo ver el manifiesto fusionado) |
| **GitHub Actions** | Permisos mínimos (`contents: read`; Pages con los suyos), secretos solo en el workflow de release y nunca impresos, el release se detiene si faltan |

## D. No verificable (y por qué)

- Comportamiento real de RLS con sesiones autenticadas, `auth.jwt()`, `auth.mfa_factors` y borrado de `auth.users` en Supabase: requiere aplicar las migraciones.
- Límites de intentos de login, SMTP y política de contraseñas: requieren el panel.
- Manifiesto Android fusionado y comportamiento de `FileProvider`/WebView en un dispositivo: requieren inspeccionar la APK o instalarla.
- Concurrencia real del bloqueo por usuario: el entorno de pruebas tiene una sola conexión.
- Fugas de memoria y comportamiento del WebView en móviles modestos.
