# Checklist de lanzamiento

Responde al «Resumen Ejecutivo» (plan maestro de 10 fases). Estado a 2026-11-05. Cada fila dice qué está **hecho**, **cómo se comprobó** y qué **falta**.

Niveles de comprobación: **Real** (servicio real o dispositivo) · **Binario real** (Electron/GitHub Actions/navegador) · **PostgreSQL** (embebido) · **Mock** (servidor o plugin simulado) · **Local** (jsdom/Node) · **—** (sin comprobar).

## Resumen en una frase

El código de todas las fases está escrito y probado en local; **lo único comprobado contra servicios reales** es la compilación en GitHub, la web publicada, el bloqueo de usuarios anónimos en 3 tablas y el camino de error de la página de confirmación. **Falta todo lo que depende de ti**: aplicar migraciones, configurar Supabase, probar con una cuenta y un móvil reales.

## Estado por fase del plan

| Fase | Estado | Evidencia | Falta |
|---|---|---|---|
| **0 · Inventario** | Hecho | `AUDITORIA_COMPLETA_BITTY.md`, `INVENTARIO_FUNCIONALIDADES.md`; rama `main`, árbol limpio salvo lo nuevo; dependencias revisadas (`npm ls`, `npm audit`) | — |
| **1 · Funcionalidad** | Hecho en local | 42 recorridos de juego, 6.000 pulsaciones aleatorias, 70 pruebas de nube, 41 de robustez. **Nuevo:** reenvío de confirmación, cambio de contraseña desde el Perfil, cierre de sesión solo del dispositivo | Pasarlo con cuenta real y móvil |
| **2 · Supabase** | Escrito y probado, **sin aplicar** | 8 migraciones, 100 + 38 pruebas SQL, 23 mutaciones, auditoría en `AUDITORIA_MIGRACIONES.md` | Aplicar 03–08; *Site URL*, *Redirect URLs*, plantilla de correo, TOTP |
| **3 · Ciberseguridad** | Hecho en local | Ver tabla de seguridad abajo | Verificar RLS con 2 cuentas reales |
| **4 · UX/UI** | Parcial | 6 pantallas + la página de confirmación revisadas en navegador real (claro/oscuro), accesibilidad corregida | Revisar Perfil, Especiales, retos y 2FA en pantalla; otros anchos; TalkBack |
| **5 · Android** | Compila; sin probar en móvil | Compilación en GitHub (APK 8,56 MB, commit anterior); botón atrás, offline y anuncios con Capacitor simulado; **enlace profundo `com.bitty.app://confirmed`** | Compilar la APK nueva, instalarla y pasar la lista de `COMPILACION_ANDROID.md`; App Links y notificaciones (ver abajo) |
| **6 · Escritorio (Electron)** | Hecho y comprobado con Electron real | App y app **empaquetada** arrancadas con Electron 45 (10/10); instalador NSIS de 116 MB generado con el icono de Bitty; 110 pruebas + 20 mutaciones. Ver `COMPILACION_ESCRITORIO.md` | Probar el **instalador** en tu PC; firma |
| **7 · Offline y sincronización** | Hecho en local | Cola de XP persistente, reinicio con eventos pendientes, sin duplicados, servidor caído/sin red (41 + 70 pruebas) | Prueba real con dos dispositivos; escritorio desconectado |
| **8 · Publicidad y privacidad** | Código listo con IDs de prueba | AdMob, consentimiento, límites, validación del bonus en servidor | Cuenta de AdMob; **política de privacidad**; autoalojar fuentes; borrado de cuenta (hecho en código, sin aplicar) |
| **9 · Página de confirmación** | Implementada | 57 pruebas + 13 mutaciones; navegador real contra Supabase real (enlace inválido → «ya no es válido»); `PAGINA_CONFIRMACION.md` | Plantilla del correo y URLs en Supabase; **camino de éxito con correo real** |

### Seguridad (fase 3 del plan)

| Punto del plan | Resultado |
|---|---|
| XSS y CSP | Sin XSS encontrado; todo texto externo escapado o con `textContent`; CSP restrictiva en la web, la página de confirmación y el escritorio. Probado con entradas hostiles |
| Inyección SQL | Cliente solo por REST parametrizado; funciones SQL con parámetros tipados y `search_path` fijado (comprobado por catálogo) |
| **CSRF** | **No aplica a la API**: las peticiones autenticadas usan cabecera `Authorization: Bearer` (no cookies), y la página de confirmación envía `credentials: omit`. El reenvío es público y lo limita Supabase. No se añaden tokens CSRF porque no hay sesión por cookie que proteger |
| **Orígenes / CORS** | Comprobado con una petición real: Supabase responde `Access-Control-Allow-Origin: *`. **Es así por diseño**: la protección no es el origen sino el token y RLS. La lista de *Redirect URLs* sí restringe a dónde pueden redirigir los correos |
| Lógica sensible en el cliente | El XP lo valida el servidor (`award_xp`); el cliente solo envía eventos. Quedan riesgos aceptados y documentados (`AUDITORIA_SEGURIDAD.md`) |
| Validación de entradas en servidor | XP, referencias, fechas, topes y tamaños se validan en SQL. **Formato de correo y política de contraseñas** los aplica GoTrue: **no verificable** sin el panel |
| *Edge Functions* | **No existen ni hacen falta**: la lógica de servidor son funciones SQL con RLS |
| Dependencias | Web: `npm audit` 0. Escritorio: **Electron 39 → 45.2.3** (las 39.x tenían avisos altos); quedan 6 moderadas en `electron-builder` (solo compilación) |
| Electron | `contextIsolation`, `sandbox`, sin Node, preload mínimo, navegación y permisos bloqueados, sin `webview`, rutas relativas, instancia única. **Comprobado con Electron real** |
| Android | `allowBackup=false`, sin tráfico en claro, un único filtro `BROWSABLE` (`com.bitty.app://confirmed`), sin App Links |
| Logs con datos privados | Ninguno |

### Lo que el plan pedía y no se puede hacer así (y qué se hizo)

| Petición del plan | Realidad |
|---|---|
| Android App Links para el correo | **Imposible en `github.io`** (exige `/.well-known/assetlinks.json` en la raíz del dominio). Se usa un esquema propio sin tokens. Posible con dominio propio |
| Notificaciones (token en Supabase) | **No existen** en Bitty: no hay Firebase ni notificaciones push. No se añaden |
| Dominio `bitty.app` | No es tuyo hoy; la web vive en `github.io`. Cambiarlo es sencillo (`PAGINA_CONFIRMACION.md`) |
| «Ranking» | No existe en Bitty (hay rangos personales, no clasificación entre usuarios) |
| `SITE_URL` con la ruta de confirmación y enlace con `{{ .Token }}` | Corregido: Site URL es la base y el enlace usa `token_hash` (ver `PAGINA_CONFIRMACION.md`) |
| «Commits locales (no se hará push)» | Cumplido: todo está en commits locales **sin subir** |

## Pruebas obligatorias del plan

| Prueba | Estado |
|---|---|
| Registro → correo → `/auth/confirm` → login | **Pendiente (tuya)**: camino de éxito sin probar con correo real. Mock 57/57; error real comprobado |
| Perfil, cambio de contraseña, logout | Mock 70/70 (**nuevo**: cambiar contraseña, cancelar, logout local). Sin cuenta real |
| Contenido y progreso (estadísticas, cerrar sesión y reingresar) | Local/Mock |
| Sincronización multidispositivo | Mock; **pendiente real** |
| Offline y reconexión | Mock/Local; **pendiente en móvil y en escritorio** |
| Confirmación de correo, enlace caducado/manipulado | Mock (caducado, ya usado, manipulado, tipos no permitidos, HTML hostil); caducado real comprobado con un token inventado |
| Seguridad: acceso a datos de otros usuarios | **PostgreSQL** (100 + 38 pruebas); **pendiente con 2 cuentas reales** |
| Análisis estático | Parser de JavaScript (12 comprobaciones), 0 `eval`, 0 botones rotos, 0 código muerto |
| Android: instalar el APK de depuración | **Pendiente (tuya)** |
| Windows: ejecutar el instalador `.exe` | Instalador generado; app empaquetada **arrancada**; **instalación pendiente (tuya)** |
| Reporte con pasos y resultados | `PRUEBAS_Y_VALIDACION.md` |

## Acciones que necesito de ti (en orden)

1. **Subir los commits** a GitHub (los 4 últimos están solo en local): me das la autorización.
2. **Instalar la APK nueva** (Actions → *Build Android APK* → *Run workflow*) en tu móvil **antes** del paso 4.
3. En **Supabase → SQL Editor**, aplicar las migraciones `03` a `08` en orden (`CONFIGURACION_SUPABASE.md`).
4. En **Supabase → Authentication**: *Site URL*, *Redirect URLs*, plantilla «Confirm signup» (texto exacto en `PAGINA_CONFIRMACION.md`) y activar TOTP.
5. **Crear una cuenta real** y seguir «Cómo probarla» de `PAGINA_CONFIRMACION.md`; decirme el resultado.
6. Lanzar **Build Bitty Desktop (Windows)** y probar el instalador (`COMPILACION_ESCRITORIO.md`).
7. Decidir: **dominio propio** (¿sí/no?), **público objetivo** (si hay menores), `applicationId` definitivo.
8. **Publicar la última versión:** lanza el workflow con `publish_release` y comprueba la página `/descargar/` (ver `ACTUALIZACIONES.md`; la APK de depuración no se actualiza encima de otra: desinstala la anterior).
8a. **RECORDATORIO — cada vez que cambie la app:** hay que publicar una versión nueva (workflow firmado y el de Windows, con `publish_release`) para que las apps instaladas muestren el aviso de actualización. Sin una Release más nueva, no avisa. Los cambios de hoy (banner sin solapar, aviso en escritorio, enlace de privacidad) **solo llegan a los móviles con la próxima APK firmada**.
8b. **iPhone:** abre la web en Safari → Compartir → «Añadir a pantalla de inicio» y sigue la lista de `IPHONE.md` (no se ha podido probar en un iPhone real).
9. **Política de privacidad:** ya existe en `/privacidad/` (preliminar). Antes de publicar en tiendas: añade tu nombre y un correo privado de contacto, y decide el público objetivo (si incluye menores cambia la publicidad). Para publicar:  cuentas de AdMob y Play Console, keystore y secretos, y autorizar el autoalojado de las fuentes (los iconos ya están hechos).

## Lo que no se puede afirmar todavía

Que el registro, la confirmación, el login, el 2FA y la sincronización funcionen **en producción**; que la APK se instale y funcione; que el instalador de Windows se instale; y que se cumplan los requisitos de Google Play. Todo eso depende de los pasos de arriba.
