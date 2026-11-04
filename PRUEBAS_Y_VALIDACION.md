# Pruebas y validación

Se ejecutan todas con `npm test` (y las ejecutan automáticamente los workflows antes de compilar o publicar). Si cualquiera falla, el comando termina con error.

## Niveles de validación

| Nivel | Qué demuestra | Qué NO demuestra |
|---|---|---|
| **Mock** (servidor simulado en jsdom) | La lógica del cliente: pantallas, peticiones que envía, manejo de respuestas | Que Supabase real responda igual |
| **PostgreSQL embebido (PGlite 18)** | SQL real: RLS, permisos, funciones, restricciones, idempotencia | GoTrue, correo, MFA real, red, límites de la plataforma |
| **Servicio real (Supabase)** | Comportamiento real de la plataforma | — |
| **Android físico** | La app en un móvil | — |

## Suites (resultado del 2026-11-04 sobre el commit `3d2d97e` + cambios locales de esta sesión)

| Archivo | Nivel | Resultado | Qué cubre |
|---|---|---|---|
| `tests/questions.test.js` | Local (jsdom) | 12.780 preguntas generadas, 0 errores | Todas las rutas × 3 dificultades × 3 idiomas: sin vacías, sin `NaN`/`undefined`, sin opciones repetidas |
| `tests/bank.test.js` | Local | 1.213/1.213 | 0 duplicados ni casi duplicados entre las 115 nuevas y el resto, 3 idiomas, **18 respuestas verificadas ejecutando el código** (Python y Node), anti-repetición por antigüedad |
| `tests/flow.test.js` | Local (jsdom) | 42 pasos | Jugar niveles y jefes ganando en 3 idiomas × 3 dificultades × 4 rutas |
| `tests/cloud.test.js` | **Mock** | 56/56 | Registro, login, logout, recuperación, nueva contraseña, enlace mágico, invitado, fusión de progreso, importación, cola de XP, 2FA completo (con TOTP RFC 6238 real), recorte del historial a <2 MB, redirección de correos, eliminar cuenta |
| `tests/sql.test.js` | **PGlite** | 79/79 | RLS entre usuarios, XP (validación, idempotencia, ritmo, tope diario, racha, anuncios), AAL1/AAL2, `activity_log`, `question_history`, `delete_my_account`, borrado en cascada |
| `tests/content.test.js` | **PGlite** | 44/44 | Integridad del contenido (1.144 preguntas, 212 lecciones), idempotencia, coincidencia con la app, permisos (lectura pública, escritura prohibida) |
| `tests/android.test.js` | **Mock** (Capacitor y AdMob simulados) | 30/30 | Botón atrás, aviso sin conexión, banner/vídeo/frecuencia/consentimiento, no hay anuncios en niveles |

## Pruebas de mutación (los tests detectan errores introducidos a propósito)

Se rompieron reglas en una copia, se comprobó que el test falla y se restauró:

- Quitar el tope diario de XP y los permisos de `stats` → fallan 2 pruebas SQL.
- Quitar el tope de 40.000 del historial y `security_invoker` de `activity_log` → fallan 3 pruebas (esta última mostró que, sin `security_invoker`, la vista filtraría datos de otros usuarios).
- Provocar un fallo en el flujo de pruebas → `npm test` termina con error (antes devolvía siempre 0; corregido).
- Bug real encontrado por los tests: el campo del código 2FA se borraba al repintar antes de enviarse.

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
- Pruebas visuales en varias resoluciones: la capa de interfaz se prueba en jsdom, que no dibuja. **Ningún test comprueba el aspecto.**
- Cambio real de dispositivo, y expiración real de sesión.

## Cómo repetirlo

```bash
npm ci
npm test
node tools/build-questions.js --check     # el HTML coincide con content/questions-extra.js
node tools/export-content.js --check      # la migración 006 coincide con la app
```
