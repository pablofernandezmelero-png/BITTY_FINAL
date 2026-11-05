# Informe final de Bitty

Fecha: 2026-11-04. Sin cuentas reales, sin móvil y sin acceso al panel de Supabase en esta sesión. Cada afirmación indica **cómo** se comprobó (niveles definidos en `PRUEBAS_Y_VALIDACION.md`): *implementado*, *probado en local*, *mock*, *PostgreSQL real embebido*, *servicio real*, *Android físico*.

## A. Estado general

**Bitty no está terminada.** El código de todas las áreas está escrito y probado en local, pero casi nada está validado contra servicios reales ni en un móvil.

Recuento sobre los 24 criterios de finalización del encargo (sin porcentajes arbitrarios):

| # | Criterio | Implementado | Validación más alta conseguida |
|---|---|---|---|
| 1 | La aplicación arranca | Sí | Local (jsdom) |
| 2 | La interfaz funciona | Sí | Local; **el aspecto no lo comprueba ningún test** |
| 3 | La navegación funciona | Sí | Local + mock Android |
| 4 | Los ejercicios funcionan | Sí | Local (42 recorridos de juego) |
| 5 | Las preguntas son válidas | Sí | Local; 18 respuestas de código **ejecutadas** |
| 6 | Banco integrado | Sí (1.144 fijas + 74 generadores) | Local |
| 7 | El progreso se conserva | Sí | Mock |
| 8 | El XP está protegido | Sí (migración 004) | **PostgreSQL real embebido**; sin aplicar en tu proyecto |
| 9 | Estadísticas coherentes | Sí | PostgreSQL real embebido |
| 10 | La sincronización funciona | Sí | Mock |
| 11 | El registro funciona | Sí | Mock |
| 12 | El login funciona | Sí | Mock |
| 13 | La recuperación de contraseña funciona | Sí | Mock |
| 14 | 2FA con Supabase real | Sí (cliente + AAL2) | Mock con TOTP real + PostgreSQL real; **nunca con Supabase Auth real** |
| 15 | RLS protege los datos | Sí | **Servicio real**, solo en `progress`/`profiles`/`stats` (usuario anónimo); el resto, PostgreSQL embebido |
| 16 | AdMob funciona | Sí (IDs de prueba) | Mock; nunca en un móvil |
| 17 | Android compila | Sí | **Servicio real** (GitHub Actions, APK de 8,56 MB) |
| 18 | Android se instala | Pendiente | Sin comprobar con la APK nueva |
| 19 | Android funciona en un dispositivo real | Pendiente | Sin comprobar |
| 20 | El modo offline funciona | Sí | Mock |
| 21 | GitHub Actions funciona | Sí | **Servicio real** (tests + APK + Pages) |
| 22 | Sin errores críticos de seguridad | Parcial | Auditoría local; el riesgo principal sigue abierto en producción (ver F) |
| 23 | Documentación actualizada | Sí | — |
| 24 | Publicación técnicamente preparada | Parcial | Falta firma, cuentas, material y decisiones (ver H) |

- **Implementación:** 22 de 24 criterios (92 %); los criterios 18 y 19 son validaciones pendientes, no código, y 22 y 24 cuentan como parciales.
- **Validación real:** 2,5 de 24 (≈10 %): compilación Android y Actions con servicio real, y media validación de RLS. Con PostgreSQL real embebido, mock o local están validados otros 18 criterios; **eso no cuenta como «funciona en producción»**.

Funcionalidades **fallidas**: ninguna conocida. Pendientes de validar: todas las que dependen de Supabase real o de un móvil.

## B. Resultados por fase

1. **Estado del repositorio:** rama `main` sincronizada con GitHub (0 por delante, 0 por detrás), sin cambios sin incluir al empezar. (Los «siete commits» del informe anterior eran en realidad cuatro nuevos más los tres anteriores; todos subidos.)
2. **Supabase:** 8 migraciones versionadas, aditivas y probadas en PostgreSQL real. Se añadieron `activity_log` (vista), `question_history` (tabla) y `delete_my_account`. **Sin aplicar en el proyecto real.**
3. **Autenticación y 2FA:** implementados; ver A.
4. **XP, estadísticas, sincronización:** servidor como autoridad vía `award_xp`; cola local de eventos con id único (reintentar no duplica); funcionamiento sin conexión conservado.
5. **Preguntas:** +115, 3 idiomas, 0 duplicados; anti-repetición por antigüedad; historial recortado al subir para no superar 2 MB.
6. **AdMob:** integrado con IDs de prueba; consentimiento, frecuencia y bloqueo en niveles.
7. **Android:** botón atrás, aviso offline, `allowBackup=false`, firma por secretos, APK compilada en Actions.
8. **Seguridad:** auditoría en F; corregidos los hallazgos locales.
9. **Actions:** `android.yml` y `pages.yml` verificados en real; `android-release.yml` sin ejecutar (faltan secretos).
10. **Publicación:** preparada en lo técnico; pendiente en lo externo (H).
11. **Pruebas finales:** C.
12. **Informes:** estos cinco documentos.

Corregido en esta sesión (no estaba pedido, lo encontré):
- Enlaces de correo en la APK: se calculaban con `https://localhost`, que Supabase rechaza; ahora usan la web publicada.
- La app no tenía forma de **borrar la cuenta**, requisito de Google Play y RGPD: añadida (migración 008 + botón con doble confirmación).

## C. Pruebas

`npm test` (código de salida 0), con el detalle en `PRUEBAS_Y_VALIDACION.md`:

- Preguntas: 12.780 generadas sin errores. Banco: 1.213/1.213. Juego: 42 pasos.
- Nube y 2FA (mock): 57/57. SQL (PostgreSQL embebido): 100/100. Migraciones desde cero, repetidas y sobre estructura de producción: 38/38. Contenido (PostgreSQL embebido): 44/44. Android y anuncios (mock): 30/30. Mutaciones de reglas SQL: 23/23 detectadas.
- Mutaciones: se rompieron reglas a propósito y los tests fallaron como debían (incluida una que demostró una fuga de datos entre usuarios sin `security_invoker`).
- `npm audit`: 0 vulnerabilidades. Escaneo de secretos: limpio.

Limitación principal: ningún test es contra Supabase real autenticado ni en un móvil.

## D. Supabase

| Migración | Estado en tu proyecto |
|---|---|
| 001 `progress` | Aplicada |
| 002 `profiles`, `stats` | Aplicada |
| 003 AAL2 (2FA) | **Sin aplicar** |
| 004 XP seguro | **Sin aplicar** |
| 005 esquema de contenido | **Sin aplicar** |
| 006 carga de contenido | **Sin aplicar** |
| 007 `activity_log`, `question_history` | **Sin aplicar** |
| 008 `delete_my_account` | **Sin aplicar** |

Comprobado en real con la clave pública (2026-11-04): las tres tablas aplicadas existen y bloquean al usuario anónimo; las nuevas dan 404.
Tablas pedidas: `profiles`, `progress`, `stats`, `courses`, `categories`, `lessons`, `exercises`, `questions`, `answers`, `xp_events`, `question_history` existen en las migraciones; `activity_log` es una vista sobre `xp_events`.
Guía: `CONFIGURACION_SUPABASE.md`.

## E. Android

- **Compilada:** sí, en GitHub Actions (ejecución #3, commit `3d2d97e`), APK de depuración de 8,56 MB con los plugins de AdMob y App.
- **Instalada y probada en un móvil:** **no** con esta versión. La APK que tienes instalada es anterior a todos estos cambios.
- **APK de release firmada:** no generada (faltan keystore y secretos). **AAB:** no generado.
- Icono propio de Bitty hecho (Android, Windows, PWA, 512 para Play). Pantalla de inicio (*splash*): la de Capacitor por defecto.
- iPhone: PWA instalable (`IPHONE.md`); sin probar en iPhone real.
- Guía y lista de pruebas en móvil: `COMPILACION_ANDROID.md`.

## F. Seguridad

| Gravedad | Hallazgo | Estado |
|---|---|---|
| **ALTO** | El XP y las estadísticas de **producción** siguen siendo escribibles por el cliente hasta que se aplique la migración 004 | Solución escrita y probada; **abierto en producción** hasta aplicarla |
| **ALTO** (corregido antes de aplicar) | La 004 inicial permitía triplicar el tope diario cambiando el campo `día` y cobrar XP con referencias inventadas | **Corregido**; ver `AUDITORIA_MIGRACIONES.md` (9 hallazgos H1–H9) |
| MEDIO (corregido) | `progress`/`profiles` conservaban privilegios por defecto sobrantes (`TRUNCATE` no pasa por RLS) | **Corregido** en la 03, pendiente de aplicar |
| MEDIO (corregido) | Bug de cliente: un rechazo por tope de 24 h bloqueaba toda la cola de XP | **Corregido** |
| MEDIO | *Site URL* de Supabase en `localhost` → correos con enlaces rotos | Config externa pendiente |
| MEDIO | Sin límite de intentos de login ni política de contraseña verificados en servidor | **No verificable** sin el panel |
| MEDIO | Sesión y token de renovación en el almacenamiento local de la app (sin cifrado del sistema) | Mitigado: sin copias de seguridad. Cifrado nativo requeriría un plugin |
| MEDIO | Sin eliminación de cuenta (Google Play / RGPD) | **Corregido** (008), pendiente de aplicar |
| MEDIO | Historial >2 MB bloqueaba la sincronización para siempre | **Corregido** |
| MEDIO | Enlaces de correo de la APK con `localhost` | **Corregido** |
| BAJO | La importación del progreso de invitado se acepta una vez, con tope de 20.000 XP: es confianza en el cliente | Aceptado y documentado |
| BAJO | La racha dentro de `progress.data` la escribe el cliente (la protegida es `stats`) | Documentado |
| BAJO | El bonus de vídeo no se valida con AdMob (SSV exige cuenta real); el servidor solo limita a 30 XP/día | Pendiente de cuenta AdMob |
| BAJO | CSP con `script-src 'unsafe-inline'` (inevitable con una sola página HTML) | Aceptado |
| INFO | Sin XSS encontrado: todo texto externo pasa por `esc()`; sin `eval` ni `document.write`; sin registros con datos privados | — |
| INFO | `npm audit` 0; sin permisos Android propios salvo `INTERNET`; `allowBackup=false`; sin tráfico en claro; sin *deep links* | — |
| INFO | Las respuestas correctas son legibles públicamente (ya viajan dentro de la app) | Aceptado |

**No se conoce ningún riesgo crítico**, salvo el ALTO de arriba, que se cierra aplicando una migración.

## G. GitHub

- Rama `main`, remoto `BITTY_FINAL`, sincronizada con lo publicado en `3d2d97e`.
- Cambios **locales sin subir** de esta sesión (commit pendiente, ver el final de este informe): migraciones 007 y 008, eliminar cuenta, corrección de los enlaces de correo y los cinco documentos.
- Workflows: `android.yml` ✓ (real), `pages.yml` ✓ (real), `android-release.yml` sin ejecutar.
- Sin `force push`, sin releases.

## H. Publicación (Google Play)

Falta: cuenta de Play Console, keystore y secretos, decidir el `applicationId` definitivo, decidir el público objetivo (si incluye menores, aplica la política *Familias*), cuenta de AdMob con IDs reales, política de privacidad en una URL pública, formulario de seguridad de datos, capturas y gráficos de la ficha, subir `versionCode`, pruebas en móvil. Detalle en `PUBLICACION_GOOGLE_PLAY.md`. **No se afirma que cumpla los requisitos de Google Play.**

## I. Acciones del propietario

1. Supabase → SQL Editor: aplicar las migraciones 003 a 008 en orden (`CONFIGURACION_SUPABASE.md`).
2. Supabase → URL Configuration: *Site URL* y *Redirect URLs* = `https://pablofernandezmelero-png.github.io/BITTY_FINAL/`.
3. Supabase → Multi-Factor: activar TOTP.
4. Crear una cuenta real de prueba y seguir los pasos de la sección 4 de `CONFIGURACION_SUPABASE.md`; decirme el resultado.
5. Lanzar de nuevo **Build Android APK** tras mis siguientes cambios, instalar en el móvil y pasar la lista de `COMPILACION_ANDROID.md`.
6. Para publicar: keystore y 4 secretos, cuenta de AdMob, cuenta de Play Console, política de privacidad y decisión del público objetivo.
7. Autorizar el siguiente `push` de los cambios locales.

## J. Veredicto

1. **¿Bitty está terminada?** No.
2. **¿Qué funciona realmente?** La web publicada, la compilación de la APK y los workflows (comprobado en real), y el bloqueo de RLS al usuario anónimo en 3 tablas. Las reglas SQL (XP, 2FA, contenido, privacidad) están comprobadas en un PostgreSQL real embebido.
3. **¿Qué está solo simulado?** Registro, login, recuperación, sincronización, 2FA completo, anuncios, botón atrás, aviso sin conexión y eliminación de cuenta: con servidores o plugins simulados.
4. **¿Qué falta para producción?** Aplicar las migraciones, la configuración del panel de Supabase, una prueba real con cuenta y una prueba en móvil, más lo de H.
5. **¿La APK está lista?** La de depuración compila, pero no está probada en un móvil. La de release no existe.
6. **¿Preparada para Google Play?** No.
7. **¿Riesgos críticos?** Ninguno crítico. Uno ALTO abierto en producción: el XP es manipulable hasta aplicar la migración 004.
8. **Porcentaje real:** implementación 22/24 criterios (92 %); validación real 2,5/24 (≈10 %). Con simulaciones y PostgreSQL embebido, 18 criterios más tienen pruebas locales, pero eso no equivale a funcionar en producción.
