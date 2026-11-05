# Bitty

App educativa de informática (español, inglés y neerlandés). Una sola página web (`www/index.html`) empaquetada como app Android con Capacitor.

> Estado: **en desarrollo, no terminada**. Lo hecho, lo simulado y lo pendiente están en [Estado del proyecto](#estado-del-proyecto) y, con todo detalle, en [`INFORME_FINAL_BITTY.md`](INFORME_FINAL_BITTY.md).

## Documentación

| Documento | Contenido |
|---|---|
| [`INFORME_FINAL_BITTY.md`](INFORME_FINAL_BITTY.md) | Estado real, seguridad, veredicto y acciones del propietario |
| [`CONFIGURACION_SUPABASE.md`](CONFIGURACION_SUPABASE.md) | Guía de migraciones, ajustes del panel y prueba con cuenta real |
| [`COMPILACION_ANDROID.md`](COMPILACION_ANDROID.md) | Compilar APK/AAB, firma, variables de entorno y pruebas en móvil |
| [`PUBLICACION_GOOGLE_PLAY.md`](PUBLICACION_GOOGLE_PLAY.md) | Lista de lo que falta para publicar |
| [`PRUEBAS_Y_VALIDACION.md`](PRUEBAS_Y_VALIDACION.md) | Qué prueba cada suite y qué no |
| [`AUDITORIA_MIGRACIONES.md`](AUDITORIA_MIGRACIONES.md) | Veredicto de cada migración, hallazgos, orden de aplicación y riesgos residuales |
| [`AUDITORIA_COMPLETA_BITTY.md`](AUDITORIA_COMPLETA_BITTY.md) | **Puntuación 61/100**, arquitectura y resultados por área |
| [`INVENTARIO_FUNCIONALIDADES.md`](INVENTARIO_FUNCIONALIDADES.md) | Todas las funcionalidades, su estado y cómo se probaron |
| [`AUDITORIA_SEGURIDAD.md`](AUDITORIA_SEGURIDAD.md) | Hallazgos de seguridad por gravedad, con evidencias y estado |
| [`AUDITORIA_SUPABASE.md`](AUDITORIA_SUPABASE.md) | Tablas, funciones, RLS, compatibilidad y pasos pendientes |
| [`PLAN_FINAL_BITTY.md`](PLAN_FINAL_BITTY.md) | Qué falta para llegar al 100 %, en orden y con dependencias |
| [`CHECKLIST_LANZAMIENTO.md`](CHECKLIST_LANZAMIENTO.md) | **Checklist final**: estado de cada fase del plan maestro y acciones que necesito de ti |
| [`PAGINA_CONFIRMACION.md`](PAGINA_CONFIRMACION.md) | Página pública `/auth/confirm/`, plantilla del correo, URLs de Supabase, alojamiento y dominio |
| [`COMPILACION_ESCRITORIO.md`](COMPILACION_ESCRITORIO.md) | App de Windows (Electron): seguridad, compilación e instalador |

## Estructura

| Ruta | Qué es |
|---|---|
| `www/index.html` | La aplicación completa (HTML + CSS + JS). |
| `content/questions-extra.js` | Preguntas ampliadas (fuente). `node tools/build-questions.js` las inserta en el HTML. |
| `tools/` | `build-questions.js` (inserta preguntas) y `export-content.js` (genera la migración 006). |
| `android/` | Proyecto Android generado por Capacitor. |
| `desktop/` | App de escritorio de Windows (Electron 45, endurecida) que empaqueta `www/`. |
| `www/auth/confirm/` | Página pública de confirmación de correo. |
| `supabase/migrations/` | Migraciones SQL versionadas (001–008). |
| `tests/` | Pruebas automáticas (`npm test`). |
| `.github/workflows/` | `android.yml` (APK de depuración), `android-release.yml` (firmado, manual), `desktop-windows.yml` (instalador de Windows, manual), `pages.yml` (web). |

## Pruebas

```bash
npm ci
npm test
```

Ejecuta: banco de preguntas (incluye **ejecutar** el código de las preguntas de Python y JavaScript), recorrido del juego, nube/2FA con un servidor simulado, **migraciones SQL en un PostgreSQL real embebido (PGlite)**, contenido y comportamiento Android (botón atrás, anuncios, conexión) con Capacitor simulado. Si algo falla, `npm test` termina con error y los workflows no generan APK ni publican.

> Qué demuestran y qué no: PGlite es PostgreSQL real, así que RLS, permisos y funciones SQL se prueban de verdad. Pero **no** es Supabase (no prueba GoTrue, correo, MFA real ni la red). Eso solo se comprueba con una cuenta real; ver abajo.

## Compilar la APK

- **Depuración** (para probar): GitHub → Actions → **Build Android APK** → Run workflow → descarga `Bitty-debug-apk`. Se firma con la clave de prueba de Android; **no sirve para Google Play**.
- **Release firmada** (para publicar): GitHub → Actions → **Build Android Release (firmado)**. Necesita estos *Secrets* en Settings → Secrets and variables → Actions (si falta alguno, el workflow se detiene con un mensaje claro y no genera nada):

  | Secret | Qué es |
  |---|---|
  | `BITTY_KEYSTORE_BASE64` | Tu archivo `.jks` en base64 |
  | `BITTY_KEYSTORE_PASSWORD` | Contraseña del keystore |
  | `BITTY_KEY_ALIAS` | Alias de la clave |
  | `BITTY_KEY_PASSWORD` | Contraseña de la clave |

  Crear el keystore (una sola vez, guárdalo a buen recaudo: si lo pierdes no podrás actualizar la app en Play):

  ```bash
  keytool -genkeypair -v -keystore bitty-release.jks -alias bitty -keyalg RSA -keysize 2048 -validity 10000
  base64 -w0 bitty-release.jks      # pega el resultado en BITTY_KEYSTORE_BASE64
  ```

  **Nunca** subas el `.jks` ni las contraseñas al repositorio (`.gitignore` ya excluye `*.jks` y `*.keystore`).

Local: Node 22, JDK 21 y el SDK de Android. En Windows, Gradle falla con rutas largas: usa una carpeta corta (`C:\bitty`).

## Supabase

La URL y la clave **pública** (`sb_publishable_…`) están en `www/index.html` (constante `SB`); la seguridad real la dan las reglas RLS. **Nunca** pongas en el repositorio ni en el cliente la clave `service_role`/`secret`.

### Migraciones (se aplican a mano en Supabase → SQL Editor, en este orden)

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `01_progreso.sql` | Tabla `progress` + RLS |
| 2 | `02_perfiles_y_estadisticas.sql` | `profiles` y `stats` + RLS + trigger de perfil |
| 3 | `03_exigir_2fa.sql` | Exige AAL2 (código 2FA) a las cuentas con 2FA activado |
| 4 | `04_xp_seguro.sql` | XP validado en el servidor (`award_xp`, `import_legacy_stats`, `xp_events`); `stats` pasa a solo lectura |
| 5 | `05_contenido_esquema.sql` | Tablas de contenido (cursos, categorías, lecciones, ejercicios, preguntas, respuestas), lectura pública |
| 6 | `06_contenido_datos.sql` | Carga las 1.144 preguntas y 212 lecciones actuales (idempotente, ~830 KB) |
| 7 | `07_actividad_e_historial.sql` | Vista `activity_log` y tabla `question_history` (el cliente aún no la usa) |
| 8 | `08_eliminar_cuenta.sql` | `delete_my_account()`: el usuario elimina su cuenta y sus datos |

Guía completa en [`CONFIGURACION_SUPABASE.md`](CONFIGURACION_SUPABASE.md). Todas son **aditivas**: no borran datos ni reinician el progreso. La 004 conserva el XP existente como `base_xp`. Es seguro desplegar la web antes o después de aplicarlas: sin la 004 el XP se queda en local y se envía cuando exista.

### Ajustes del panel (no se pueden hacer desde el código)

1. **Authentication → URL Configuration**: *Site URL* = `https://pablofernandezmelero-png.github.io/BITTY_FINAL/` y esa misma dirección en *Redirect URLs*. Sin esto, los enlaces del correo (confirmar, recuperar contraseña, enlace mágico) apuntan a `localhost`.
2. **Authentication → Sign In / Providers → Multi-Factor**: activar **TOTP** (Enroll y Verify) para que funcione el 2FA.
3. Opcional: SMTP propio (el correo por defecto de Supabase tiene un límite bajo de envíos por hora).

## Anuncios (AdMob)

Código listo con **IDs de prueba oficiales de Google** (`ADS` en `www/index.html` y `BITTY_ADMOB_APP_ID` en `android/app/build.gradle`). Banner solo en el inicio, bonus con vídeo recompensado (3 al día), consentimiento RGPD (UMP) y **nunca** durante niveles, jefes, retos ni pantallas de resultado.

Para producción (necesitas cuenta de Google AdMob): crea la app y las unidades de anuncio, pon tus IDs en `ADS.banner` / `ADS.rewarded`, cambia `ADS.test` a `false` y define el secreto `BITTY_ADMOB_APP_ID` (ID de aplicación, formato `ca-app-pub-…~…`). No uses anuncios reales hasta tener tu cuenta.

## Estado del proyecto

| Área | Estado | Cómo se comprobó |
|---|---|---|
| Web publicada y APK de depuración | Hecho | Workflows en GitHub; web idéntica al repositorio |
| Conexión con Supabase y RLS de `progress`/`profiles`/`stats` | **Comprobado en el servicio real** | Lecturas/escrituras anónimas con la clave pública |
| Registro, login, recuperación, sesiones, sincronización | Simulación | Servidor simulado; **falta probar con una cuenta real** |
| XP validado en servidor (migración 004) | Probado en PostgreSQL real; **sin aplicar aún en tu proyecto: hasta entonces el XP de producción es manipulable** | `tests/sql.test.js` |
| 2FA TOTP (cliente + AAL2 en servidor) | Simulación (TOTP real, GoTrue simulado) + SQL real; **falta activar MFA y probar con Authenticator** | `tests/cloud.test.js`, `tests/sql.test.js` |
| Banco de preguntas (+115, 1.144 fijas + 74 generadores) | Hecho y verificado | `tests/bank.test.js` (código ejecutado, 0 duplicados) |
| Base de datos de contenido (005/006) | Probada en PostgreSQL real; **sin aplicar aún** | `tests/content.test.js` |
| Eliminar cuenta (008) y registro de actividad (007) | Probados en PostgreSQL real y con mock; **sin aplicar aún** | `tests/sql.test.js`, `tests/cloud.test.js` |
| Anuncios | Simulación con IDs de prueba; **no probado en un móvil** | `tests/android.test.js` |
| Botón atrás, aviso sin conexión, sin copias de seguridad | Simulación; **no probado en un móvil** | `tests/android.test.js` |
| Firma de release y Google Play | Preparado; **faltan keystore y cuenta de Play** | — |

## Credenciales y servicios externos que faltan

| Servicio | Para qué | Estado |
|---|---|---|
| Supabase (panel) | URL del sitio, MFA/TOTP, aplicar migraciones 003–006 | Lo haces tú (ver arriba) |
| Google AdMob | IDs reales de anuncios | **Sin cuenta**: se usan IDs de prueba |
| Google Play Console | Publicar | **Sin cuenta** (pago único de 25 USD) |
| Keystore de release | Firmar la APK/AAB | **Sin crear**: se guarda como *GitHub Secrets*, nunca en el repo |

## Limitaciones conocidas

- Sin códigos de recuperación de 2FA (Supabase no los ofrece): conviene registrar un segundo dispositivo. Si se pierde el único, se resetea desde el panel (Authentication → Users).
- La importación del progreso local al crear cuenta (`import_legacy_stats`) se acepta **una vez** y con tope (20.000 XP): es la única parte basada en confianza.
- La racha dentro de `progress.data` sigue siendo del cliente; la racha y el XP **protegidos** son los de `stats`.
- La sesión se guarda en el almacenamiento local de la app (privado de la app, sin copias de seguridad). Un almacén cifrado por el sistema (Keystore) requeriría un plugin nativo adicional.
- La APK incluye la web empaquetada: para actualizarla hay que compilar una APK nueva (Actions). La web de GitHub Pages sí se actualiza sola al hacer `push`.
