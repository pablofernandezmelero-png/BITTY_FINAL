# Preparación para Google Play

> **No se ha publicado nada ni se ha realizado ningún pago.** Este documento es una lista de lo que hay que completar. Los requisitos de Google Play cambian con frecuencia y **no se han podido verificar desde aquí**: confírmalos en la Play Console antes de enviar. Nada de lo siguiente garantiza la aprobación.

## Qué está técnicamente preparado

- Formato AAB: el workflow `Build Android Release (firmado)` genera `app-release.aab` firmado (aún no ejecutado: faltan los secretos de firma).
- `targetSdk` 36, `minSdk` 24.
- Sin copias de seguridad automáticas, sin tráfico en claro, un único permiso propio (`INTERNET`).
- Consentimiento publicitario (UMP) implementado en la app; anuncios con IDs de **prueba**.
- Política de seguridad de datos: RLS en todas las tablas, XP validado en el servidor, 2FA opcional.

## Qué falta (acciones del propietario)

### Cuentas y claves
1. Cuenta de **Google Play Console** (pago único de 25 USD, lo realizas tú). Puede exigir verificación de identidad y, para cuentas personales nuevas, un periodo de pruebas cerradas antes de producción.
2. **Keystore de release** (ver `COMPILACION_ANDROID.md`) y los 4 *Secrets* de GitHub. Guarda el `.jks` fuera del repositorio y con copia de seguridad. Si activas *Play App Signing*, Google custodia la clave final y la tuya queda como clave de subida.
3. Cuenta de **Google AdMob**: crea la app y las unidades (banner y recompensado), y entrégame o configura tú: ID de aplicación (`ca-app-pub-…~…`) e IDs de unidad (`ca-app-pub-…/…`). Hasta entonces se mantienen los de prueba.

### Decisiones antes de la primera subida
4. **`applicationId` definitivo.** Hoy es `com.bitty.app`; en cuanto se sube a Play no se puede cambiar. Si quieres otro (por ejemplo con un dominio tuyo), se cambia en `android/app/build.gradle`, `capacitor.config.json` y en el `namespace` **antes** de publicar.
5. **Público objetivo.** Es una app educativa; si va dirigida a menores de 13 años (o a un público mixto con niños), Google aplica la política *Familias* y los anuncios y el tratamiento de datos tienen requisitos mucho más estrictos (incluida la selección de redes publicitarias certificadas). **Decide el público antes de configurar AdMob y la ficha.** El código actual no está preparado para un público infantil (por ejemplo, no activa el tratamiento «dirigido a niños» en AdMob).

### Privacidad y fuentes (hallazgo de la auditoría)
5b. **Google Fonts**: la web carga las fuentes Fredoka y Nunito desde `fonts.googleapis.com` / `fonts.gstatic.com`. Eso envía la IP del usuario a Google **sin consentimiento previo** (riesgo RGPD) y falla sin conexión (cae a fuentes del sistema). Solución recomendada: **autoalojar los `.woff2`** dentro de la app (paso 6 de `PLAN_FINAL_BITTY.md`; requiere descargarlos y tu permiso). Hasta entonces, **debe constar en la política de privacidad**.
5c. **Permisos fusionados**: el manifiesto propio solo declara `INTERNET`; el plugin de anuncios añade `ACCESS_NETWORK_STATE` y el SDK de Google añade los suyos (entre ellos el ID de publicidad). **No se pudo inspeccionar el manifiesto fusionado de la APK**: revísalo (`apkanalyzer manifest print app-debug.apk`) y declara cada permiso en la ficha.

### Material de la ficha
6. **Icono** de 512×512 y los iconos de la app (hoy son los de Capacitor por defecto) y **pantalla de inicio** de Bitty.
7. **Gráfico de funciones** (1024×500) y capturas de pantalla del móvil (sale de la APK real).
8. Descripción corta y larga (es/en/nl si quieres las tres).
9. **Política de privacidad publicada en una URL pública.** Debe describir al menos: correo y contraseña (gestionados por Supabase), progreso/XP/estadísticas, identificador de publicidad y datos de anuncios (Google AdMob), 2FA, retención y cómo borrar la cuenta, contacto del responsable. Redáctala con la información real del propietario; no se incluye una plantilla porque depende de tus datos y de la ley aplicable.
10. **Formulario de seguridad de los datos** (Data safety) coherente con lo anterior, y **clasificación de contenido**.
11. **Eliminación de cuenta**: Google exige poder solicitarla dentro de la app y desde una URL web que indiques en la ficha. Bitty ya tiene el botón **«Eliminar mi cuenta y mis datos»** en el Perfil (migración 008, simulado y probado en PostgreSQL; **sin aplicar ni probar con Supabase real**). Falta una página web pública que explique cómo pedir el borrado (puede ser la propia política de privacidad).
12. Declaración del **ID de publicidad** (el plugin de AdMob lo usa) en la sección de anuncios/permisos de la Play Console.
13. `app-ads.txt` en el sitio web del desarrollador, si publicas con AdMob y lo quieres para maximizar ingresos.

### Proceso recomendado
14. Subir el AAB a **Pruebas internas**, instalar desde Play y repetir la lista de `COMPILACION_ANDROID.md`.
15. Tras la prueba real en móvil, subir `versionCode` en cada nueva versión.
16. Pasar a producción solo con la lista de `INFORME_FINAL_BITTY.md` completada.

## Lo que NO se puede afirmar hoy

- Que Bitty cumple todos los requisitos de Google Play: pendientes la política de privacidad, el borrado de cuenta, los datos de AdMob, el público objetivo, el icono y la prueba en dispositivo real.
- Que la app esté aprobada o publicable: no se ha enviado nada.
