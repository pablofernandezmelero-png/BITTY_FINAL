# Pruebas y validación

Se ejecutan todas con `npm test` (y las ejecutan automáticamente los workflows antes de compilar o publicar). Si cualquiera falla, el comando termina con error.

## Niveles de validación

| Nivel | Qué demuestra | Qué NO demuestra |
|---|---|---|
| **Mock** (servidor simulado en jsdom) | La lógica del cliente: pantallas, peticiones que envía, manejo de respuestas | Que Supabase real responda igual |
| **PostgreSQL embebido (PGlite 18)** | SQL real: RLS, permisos, funciones, restricciones, idempotencia | GoTrue, correo, MFA real, red, límites de la plataforma |
| **Servicio real (Supabase)** | Comportamiento real de la plataforma | — |
| **Android físico** | La app en un móvil | — |

## Suites (resultado del 2026-11-04 con los cambios locales de la auditoría; `npm test` termina con código 0)

| Archivo | Nivel | Resultado | Qué cubre |
|---|---|---|---|
| `tests/static.test.js` | Análisis estático (parser acorn) | 12/12 | Sin `eval`/`document.write`, 276 traducciones con los 3 idiomas, 0 código muerto, 33 manejadores de la interfaz definidos (sin botones rotos), CSP restrictiva, solo clave pública en el cliente, accesibilidad básica |
| `tests/questions.test.js` | Local (jsdom) | 12.780 preguntas generadas, 0 errores | Todas las rutas × 3 dificultades × 3 idiomas: sin vacías, sin `NaN`/`undefined`, sin opciones repetidas |
| `tests/bank.test.js` | Local | 1.213/1.213 | 0 duplicados ni casi duplicados, 3 idiomas, **18 respuestas verificadas ejecutando el código** (Python y Node), anti-repetición por antigüedad |
| `tests/flow.test.js` | Local (jsdom) | 42 pasos | Jugar niveles y jefes ganando en 3 idiomas × 3 dificultades × 4 rutas |
| `tests/cloud.test.js` | **Mock** | 57/57 | Registro, login, logout, recuperación, enlace mágico, invitado, fusión, cola de XP, 2FA completo (TOTP RFC 6238 real), recorte del historial, redirección de correos, eliminar cuenta, rechazos por tope |
| `tests/robustness.test.js` | **Mock** | 32/32 | Estado corrupto o de versión antigua, almacenamiento ausente o lleno, contenido hostil, sesión caducada, servidor 500 y sin red, **reinicio con eventos pendientes**, enlace con token de otra cuenta, botón de reinicio con y sin cuenta, nodos del mapa accesibles |
| `tests/monkey.test.js` | Local (jsdom) | 10/10 · **6.000 acciones aleatorias** | 5 semillas fijas, pulsando controles visibles y escribiendo texto, sin red: sin excepciones ni estados absurdos. Encontró un fallo real |
| `tests/sql.test.js` | **PGlite** | 100/100 | RLS entre usuarios, XP (validación, referencias, retos, topes de 24 h, repeticiones y anuncios, ritmo, racha, idempotencia), AAL1/AAL2, `activity_log`, `question_history`, `delete_my_account`, cascada |
| `tests/migrations.test.js` | **PGlite** | 38/38 | Las 8 migraciones desde cero y **dos veces**; sobre una estructura equivalente a producción con datos (sin cambios en `progress`/`profiles`/`stats`); auditoría del catálogo (RLS, `search_path`, privilegios, vistas, claves ajenas, AAL2) |
| `tests/content.test.js` | **PGlite** | 44/44 | 1.144 preguntas y 212 lecciones, idempotencia, coincidencia con la app, permisos |
| `tests/android.test.js` | **Mock** (Capacitor y AdMob simulados) | 30/30 | Botón atrás, aviso sin conexión, banner/vídeo/frecuencia/consentimiento, sin anuncios en niveles |

**Total: 1.578 comprobaciones explícitas, 12.780 preguntas generadas verificadas y 6.000 acciones aleatorias.**

## Pruebas de mutación (los tests detectan errores introducidos a propósito)

Se rompe **una regla cada vez**, se comprueba que algún test falla y se restaura. **35 mutaciones, 35 detectadas.**

- **23 reglas de seguridad SQL** (`node tools/mutation-sql.js`): tope de 24 h con fecha del cliente, referencias libres, XP de retos, topes de anuncios y repeticiones, ritmo, importación con eventos, permisos de `stats`, guarda de la migración 04, AAL2 en `award_xp`/`delete_my_account`/políticas, `search_path`, ejecución por `anon`, privilegios de `progress`/`profiles`, `security_invoker`, tope del historial, borrado de cuentas ajenas, escritura de contenido. La primera pasada dejó 2 sin detectar (huecos de los tests, cubiertos).
- **7 reglas del análisis estático** (sobre copias del HTML): `eval`, botón que llama a una función inexistente, traducción con 2 idiomas, función muerta, clave secreta en el cliente, CSP abierta, zoom bloqueado.
- **5 reglas del cliente**: guardado con cuota llena, `home()` sin ruta (excepción del botón atrás), confirmación de cambio de cuenta por enlace, botón de reinicio con cuenta, cola de XP ante un tope.

Los fallos encontrados por las propias pruebas: ver `AUDITORIA_SEGURIDAD.md` (C1–C14).

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
