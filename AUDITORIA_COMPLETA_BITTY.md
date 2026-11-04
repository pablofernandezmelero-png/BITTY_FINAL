# Auditoría completa de Bitty

Fecha: 2026-11-04. Auditoría integral sobre el estado real del repositorio (rama `main`, commit `bf353a3` + cambios locales de esta auditoría, sin subir). Documentos complementarios: [`INVENTARIO_FUNCIONALIDADES.md`](INVENTARIO_FUNCIONALIDADES.md), [`AUDITORIA_SEGURIDAD.md`](AUDITORIA_SEGURIDAD.md), [`AUDITORIA_SUPABASE.md`](AUDITORIA_SUPABASE.md), [`AUDITORIA_MIGRACIONES.md`](AUDITORIA_MIGRACIONES.md), [`PLAN_FINAL_BITTY.md`](PLAN_FINAL_BITTY.md), [`PRUEBAS_Y_VALIDACION.md`](PRUEBAS_Y_VALIDACION.md), [`PUBLICACION_GOOGLE_PLAY.md`](PUBLICACION_GOOGLE_PLAY.md).

## Veredicto

**Puntuación global: 61 sobre 100** (60,65 exacto).
**Confianza de la auditoría: ≈ 65 %** (explicada abajo; la nota real podría moverse unos ±10 puntos al probar Supabase real y un móvil).

Bitty es un producto **bien construido en lo que se puede comprobar en local** (código, SQL, contenido, interfaz) pero **casi sin validar contra los servicios reales ni en un móvil**. La nota no premia lo que está escrito y aún no se ha podido demostrar en producción.

## Cómo se ha medido la nota

Media ponderada con los pesos pedidos. Cada área se puntúa por lo **demostrado**, no por lo implementado: lo que solo funciona contra un servidor simulado, o no se ha probado en un móvil, tiene la puntuación limitada.

| Área | Peso | Nota | Puntos |
|---|---:|---:|---:|
| Funcionalidad general | 15 | 70 | 10,50 |
| Arquitectura y calidad del código | 10 | 55 | 5,50 |
| Seguridad | 15 | 60 | 9,00 |
| Supabase y base de datos | 12 | 55 | 6,60 |
| Autenticación y 2FA | 8 | 50 | 4,00 |
| Contenido educativo | 8 | 78 | 6,24 |
| UX/UI y accesibilidad | 8 | 72 | 5,76 |
| Rendimiento | 6 | 70 | 4,20 |
| Android y Capacitor | 8 | 45 | 3,60 |
| Offline y sincronización | 5 | 70 | 3,50 |
| AdMob, privacidad y Google Play | 5 | 35 | 1,75 |
| **Total** | **100** | | **60,65** |

(El enunciado habla de 12 áreas pero la tabla de pesos tiene 11; se han puntuado las 11.)

## Arquitectura

```
www/index.html  (un solo archivo: 449 KB, 153 KB comprimido, 1.340 líneas de JS, 450 funciones)
 ├─ Contenido: BANKS (19 bancos, 1.144 preguntas fijas) + FACTS + XTRA (115 nuevas) · X (74 generadores)
 │             T (4 rutas, 212 niveles, 37 jefes) · SP (17 especiales) · CHS (retos diario/semanal)
 ├─ Estado local: S (localStorage «bitty») · historial anti-repetición (HSs/HSd) · cola de XP («bitty_xq»)
 │                sesión («bitty_auth») · anuncios («bitty_ads»)
 ├─ Juego: pick → go → start → q → check → nx → fin · rangos · racha · retos · especiales
 ├─ Nube: sbf (REST sin librería) · login/registro/recuperación · csync/cpush/cmerge ·
 │        cola de XP (xevPush/xflush/xsync) · 2FA (mfa*) · eliminar cuenta
 ├─ Android: botón atrás · aviso sin conexión · anuncios (banner + vídeo recompensado)
 └─ Interfaz: show/navr/home/welcome/perfil + a11y()

Supabase (8 migraciones) → 12 tablas/vistas · 6 funciones · 21 políticas · 10 claves ajenas
Capacitor (android/) → plugins @capacitor/app y @capacitor-community/admob · AndroidManifest endurecido
GitHub Actions → android.yml (APK debug) · android-release.yml (firmado, manual) · pages.yml (web)
Tests → 11 suites (npm test)
```

Relación clave: **el juego funciona sin red** (contenido y estado locales). Supabase añade cuentas, sincronización y, sobre todo, la **autoridad del XP**: la app guarda las recompensas como eventos en una cola local y el servidor las valida (`award_xp`) y manda sobre el XP.

## Qué se inspeccionó

- **Archivos analizados: 93** de código, SQL, configuración, workflows y pruebas (los 90 rastreados al empezar + 3 pruebas nuevas), más los documentos. Los 26 PNG de iconos y pantallas de inicio solo se comprobaron por tamaño/uso (los de Capacitor por defecto), no visualmente.
- JavaScript: 100 % analizado con un parser real (acorn): 273 declaraciones de nivel superior (0 sin uso tras la limpieza), 33 funciones llamadas desde la interfaz (todas definidas), 276 llamadas de traducción (todas con los 3 idiomas), 450 funciones.
- SQL: 100 % ejecutado en PostgreSQL real embebido (PGlite 18), desde cero, dos veces y sobre una estructura de producción simulada.
- Interfaz: renderizada y recorrida en un **navegador real** a tamaño de móvil (375×812), en claro y oscuro: bienvenida, nombre, elegir ruta, mapa, pregunta y acierto. **No** se vieron en pantalla: Perfil, Especiales, retos, 2FA ni anuncios.
- Servicios reales: sondeo de Supabase con la clave pública (RLS) y las ejecuciones reales de GitHub Actions.

**Confianza ≈ 65 %**: la inspección del código es casi total (≈ 100 %), pero solo ≈ 10 % de los criterios de la lista de finalización están verificados contra servicios reales o un dispositivo. Como la mayor parte de la nota depende de comportamientos que solo se prueban ahí, la confianza global se estima en ≈ 65 % y no en el 100 % de inspección.

## Resultados por área

### Funcionalidad general — 70
**Prueba:** 42 recorridos de juego (niveles y jefes ganados, 3 idiomas × 3 dificultades × 4 rutas), 6.000 pulsaciones aleatorias con semilla fija, 33/33 manejadores de la interfaz resueltos, recorrido real en navegador.
**Hallazgos de esta auditoría:** 4 fallos funcionales reales descubiertos y corregidos (ver `AUDITORIA_SEGURIDAD.md` y abajo): el botón de reinicio incoherente con cuenta, la excepción del botón «atrás» tras reiniciar, la pérdida silenciosa del guardado con almacenamiento lleno y el inicio de sesión por enlace sin confirmación.
**Pendiente:** ninguna comprobación en un móvil ni con backend real; Perfil, Especiales y retos no se han visto en pantalla.
**Para 100:** pasar la lista del móvil de `COMPILACION_ANDROID.md` y la cuenta real de `CONFIGURACION_SUPABASE.md`.

### Arquitectura y calidad del código — 55
**Bien:** pruebas muy amplias, herramientas de generación (`build-questions`, `export-content`, `mutation-sql`), código muerto demostrado y eliminado (`chPick`, `chTier`, `G`, `BRC`), 0 vulnerabilidades en dependencias.
**Mal:** todo en **un solo archivo de 449 KB**; líneas de hasta 89.494 caracteres (6 de más de 2.000), 33 variables globales mutables, estilo muy comprimido que dificulta revisar y depurar. Cualquier cambio exige tocar ese archivo.
**Para 100:** dividir en módulos (datos, juego, nube, UI) con un paso de empaquetado, sin cambiar comportamiento; el test estático y los tests de flujo permiten hacerlo con red de seguridad.

### Seguridad — 60
**Bien:** diseño del servidor sólido (verificado con 100 + 38 pruebas SQL y 23 mutaciones); CSP restrictiva (sin `eval`, `script-src` sin orígenes externos); el cliente solo lleva la clave pública; sin XSS encontrado; `npm audit` 0.
**Mal:** **el riesgo ALTO sigue abierto en producción**: hasta aplicar la migración 004, el XP y las estadísticas reales son escribibles por el cliente. Nada de lo nuevo está aplicado en Supabase. Todo se comprobó en un PostgreSQL embebido, no en el real.
**Para 100:** aplicar las migraciones, verificar RLS con dos cuentas reales, activar y probar el 2FA real.

### Supabase y base de datos — 55
**Bien:** 8 migraciones idempotentes (ejecutadas dos veces sin cambios), auditadas (9 hallazgos corregidos, incluidos 2 altos), sin pérdida de datos sobre una estructura de producción simulada, 23/23 mutaciones detectadas.
**Mal:** **ninguna migración 003–008 aplicada**; no verificado el comportamiento de `auth.jwt()`, `auth.mfa_factors` ni el borrado de `auth.users` en Supabase real; `question_history` sin usar.
**Para 100:** aplicarlas, ejecutar las consultas de verificación y la prueba de dos cuentas.

### Autenticación y 2FA — 50
**Bien:** registro, login, logout, recuperación, enlace mágico, cambio de contraseña, sesión persistente, 2FA completo y eliminar cuenta implementados; 57 pruebas con servidor simulado y TOTP real (RFC 6238). **Se ha creado al menos una cuenta real** (la del propietario, según indicó), lo que indica que el registro funciona contra Supabase real.
**Mal:** el inicio de sesión real, el correo de confirmación, la recuperación y el 2FA nunca se han probado con servicios reales; el *Site URL* de Supabase puede seguir en `localhost`; sin protección contra enlaces con token (flujo implícito, sin PKCE).
**Para 100:** pasos 3–4 de `CONFIGURACION_SUPABASE.md` y, opcionalmente, migrar a PKCE.

### Contenido educativo — 78
**Bien:** 1.144 preguntas fijas + 74 generadores, 3 idiomas completos (276 textos de interfaz con los 3 idiomas, títulos de niveles traducidos), 0 duplicados, 18 respuestas de código verificadas ejecutándolas, anti-repetición que nunca bloquea (0,2–1,2 ms con todo visto).
**Mal:** **profundidad desigual**: 43 de 636 combinaciones nivel×dificultad producen menos de 30 variantes distintas (mínimo 10); 23 niveles afectados (p. ej. «AND, OR y NOT con trampa», «¿Cuánto tarda este código?», «typeof null y otras sorpresas»). Se repiten mucho al rejugar. Algunas preguntas generadas no pueden verificarse automáticamente.
**Para 100:** ampliar los bancos de esos 23 niveles (lista en `PLAN_FINAL_BITTY.md`).

### UX/UI y accesibilidad — 72
**Bien:** diseño coherente y atractivo, modo claro y oscuro consistentes, navegación clara, controles táctiles amplios, `lang` y zoom correctos. Corregido en esta auditoría: 5 contrastes por debajo de WCAG AA (el gris de texto secundario 3,82:1, estados de acierto/error y el botón en modo oscuro 2,72:1), campos sin etiqueta, sin foco de teclado, sin avisos `aria-live`, nodos del mapa sin nombre (el lector oía «1» o «candado»), confeti ignorando «reducir movimiento».
**Mal:** solo vista en un ancho (375 px) y un navegador; el botón de invitado queda bajo el pliegue en la bienvenida; la cabecera fija se superpone a las tarjetas al desplazar; el contraste no se ha medido en todos los estados; sin pruebas con lector de pantalla real.
**Para 100:** revisión en móviles reales y con TalkBack; pruebas visuales automáticas.

### Rendimiento — 70
**Medido:** web 449 KB (153 KB comprimida); generar un nivel 0,01–1,2 ms; guardar el estado con 40.000 entradas de historial ≈ 6 ms de serialización (en escritorio); sin temporizadores huérfanos; animaciones terminan solas.
**Corregido:** el historial al máximo (~5 MB) alcanzaba el límite de `localStorage` y **el progreso local dejaba de guardarse sin avisar**; ahora se recorta lo más antiguo y se reintenta.
**Mal:** nada medido en un móvil real ni con memoria; Google Fonts es una petición externa; la escritura síncrona de varios MB en cada pregunta puede notarse en móviles modestos.
**Para 100:** perfilar en un móvil modesto; guardar el historial aparte del estado principal.

### Android y Capacitor — 45
**Bien:** compila en GitHub Actions con los plugins actuales (APK de 8,56 MB); manifiesto endurecido (`allowBackup=false`, sin tráfico en claro, un solo permiso propio + los del SDK de anuncios, `FileProvider` acotado); firma de release preparada.
**Mal:** **nunca se ha instalado ni ejecutado esta versión en un móvil**; el botón atrás, el aviso sin conexión y los anuncios solo están probados con Capacitor simulado; icono y pantalla de inicio por defecto; sin AAB firmado; `minifyEnabled false`; no se pudo ver el manifiesto fusionado.
**Para 100:** instalar la APK nueva y pasar la lista de `COMPILACION_ANDROID.md`; generar el AAB firmado.

### Offline y sincronización — 70
**Bien:** el juego funciona sin red; la cola de XP sobrevive a cierres inesperados y reinicios, no duplica eventos (id único), se conserva ante servidor caído o sin red, y un rechazo definitivo ya no bloquea la cola. 57 + 32 pruebas, incluida una de reinicio con eventos pendientes.
**Mal:** todo con servidor simulado; el servidor es la autoridad del XP, así que el XP ganado con una APK antigua después de aplicar la migración 004 se perdería al actualizar; cambiar de cuenta sin conexión puede perder eventos pendientes de la anterior.
**Para 100:** prueba real con dos dispositivos y conexión intermitente.

### AdMob, privacidad y Google Play — 35
**Bien:** integración completa con IDs de prueba oficiales, consentimiento RGPD, límites y bonus validado por el servidor; requisitos de Play identificados.
**Mal:** nada probado en un móvil; **no hay política de privacidad**, ni cuenta de AdMob/Play, ni icono propio; **Google Fonts se carga desde servidores de Google sin consentimiento** (relevante para el RGPD); decisión de público objetivo pendiente (si hay menores aplica la política *Familias*); el `applicationId` es provisional.
**Para 100:** ver `PUBLICACION_GOOGLE_PLAY.md`.

## Problemas encontrados en esta auditoría

**24 hallazgos nuevos: 14 corregidos, 10 abiertos.** (Aparte, la auditoría de migraciones de la sesión anterior documentó 9 más, todos corregidos, en `AUDITORIA_MIGRACIONES.md`.)

**Corregidos (14):** guardado local que fallaba en silencio con la cuota llena · inicio de sesión por enlace que podía sustituir progreso sin avisar · «Borrar progreso» incoherente con cuenta · excepción del botón atrás tras reiniciar · contrastes insuficientes · campos sin etiqueta · sin foco de teclado · sin `aria-live` · nodos del mapa sin nombre · fichas sin teclado · confeti ignorando «reducir movimiento» · código muerto (4 elementos) · `FileProvider` demasiado amplio · espaciado de las etiquetas del login.

**Abiertos (10):** Google Fonts externo · archivo monolítico · 23 niveles con repertorio corto · sin PKCE · pérdida posible al cambiar de cuenta sin conexión · botón de invitado bajo el pliegue · cabecera fija superpuesta · `minifyEnabled false` · sin pruebas en dispositivo ni visuales automáticas · `question_history` sin conectar.

## Recomendaciones (resumen; detalle en `PLAN_FINAL_BITTY.md`)

1. Aplicar migraciones 003–008 (tras instalar la APK nueva) y verificar con dos cuentas reales.
2. Probar la APK nueva en un móvil.
3. Autoalojar las fuentes y escribir la política de privacidad.
4. Ampliar los 23 niveles con repertorio corto.
5. Dividir `index.html` en módulos con un paso de empaquetado.
