# Compilación y pruebas en Android

## Datos de la app

| Dato | Valor actual | Nota |
|---|---|---|
| `applicationId` | `com.bitty.app` | **Provisional.** Una vez subida a Google Play no se puede cambiar |
| Nombre | Bitty | |
| `versionCode` / `versionName` | `1` / `1.0` | `versionCode` debe subir en cada publicación (`android/app/build.gradle`) |
| `minSdk` / `targetSdk` / `compileSdk` | 24 / 36 / 36 | |
| Permisos propios | solo `INTERNET` | El plugin de AdMob añade los suyos al fusionar el manifiesto (acceso a red y el ID de publicidad); revísalos en el manifiesto fusionado antes de publicar |
| Copias de seguridad | desactivadas (`allowBackup=false` + reglas de extracción) | La sesión y el progreso local no salen del dispositivo |
| Tráfico en claro | prohibido | |
| Icono | **El de Bitty** (robot, `tools/make-icons.js`) | Icono adaptable con fondo `#6D4AFF` y primer plano propio |
| Pantalla de inicio (*splash*) | Los de Capacitor por defecto | Pendiente de sustituir |
| Plugins | `@capacitor/app`, `@capacitor-community/admob` | |

## APK de depuración (para pruebas)

La compila GitHub, sin instalar nada en tu equipo:

1. GitHub → **Actions → Build Android APK → Run workflow** (rama `main`).
2. El workflow ejecuta `npm ci`, **`npm test`**, `cap sync` y `./gradlew assembleDebug`. Si una prueba falla, no hay APK.
3. Descarga `Bitty-debug-apk` de *Artifacts* (zip con `app-debug.apk`).

Estado verificado: la ejecución #3 (commit `3d2d97e`) compiló con todos los plugins y generó una APK de 8,56 MB.

La APK de depuración está firmada con la clave de depuración de Android: **sirve para probar, no para publicar**.

## APK/AAB de release (para distribuir)

Workflow manual **Build Android Release (firmado)**. Necesita estos *Secrets* en *Settings → Secrets and variables → Actions*; si falta alguno de los cuatro obligatorios, se detiene con un mensaje claro y no genera nada:

| Secret | Obligatorio | Contenido |
|---|---|---|
| `BITTY_KEYSTORE_BASE64` | sí | El `.jks` codificado en base64 |
| `BITTY_KEYSTORE_PASSWORD` | sí | Contraseña del keystore |
| `BITTY_KEY_ALIAS` | sí | Alias de la clave |
| `BITTY_KEY_PASSWORD` | sí | Contraseña de la clave |
| `BITTY_ADMOB_APP_ID` | no | ID de aplicación de AdMob de producción. Sin él se usa el ID de **prueba** de Google |

Crear el keystore (una vez; guarda copia en lugar seguro, sin él no podrás actualizar la app):

```bash
keytool -genkeypair -v -keystore bitty-release.jks -alias bitty -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 bitty-release.jks     # pega el resultado en BITTY_KEYSTORE_BASE64
```

Genera `app-release.aab` (el formato que pide Google Play) y `app-release.apk`. El `.jks` y las contraseñas **nunca** van al repositorio (`.gitignore` excluye `*.jks` y `*.keystore`). **Este workflow todavía no se ha ejecutado** porque faltan los secretos.

## Compilar en tu equipo (opcional)

Requisitos: Node 22, JDK 21 y el SDK de Android. En Windows, Gradle falla con rutas largas: usa una carpeta corta como `C:\bitty`.

```bash
npm ci
npm test
npx cap sync android
cd android && ./gradlew assembleDebug      # en Windows: gradlew assembleDebug
```

## Lista de pruebas en un móvil real (pendiente: no realizada)

Instala `app-debug.apk` (si Android se queja, desinstala la anterior; el progreso en la nube no se pierde) y comprueba:

1. Primer arranque: bienvenida, formulario de login **centrado**.
2. Registro, correo, confirmación, inicio de sesión.
3. 2FA: activar con el QR, cerrar sesión, volver a entrar con código.
4. Jugar un nivel y un jefe; XP y racha cambian; tras unos segundos aparecen en Supabase.
5. Botón atrás: en un nivel pregunta antes de salir; en el inicio avisa y sale con la segunda pulsación; en Perfil/Especiales vuelve a Ruta.
6. Anuncios: banner solo en el inicio y **sin tapar** la barra inferior; *Perfil → Ver vídeo* muestra un anuncio de prueba y da +10 bytes; máximo 3 al día; ninguno durante un nivel.
7. Modo avión: aparece el aviso naranja y se puede seguir jugando; al volver la conexión se sincroniza.
8. Cerrar la app del todo y abrirla: sigue la sesión y el progreso.
9. Girar la pantalla, abrir el teclado en los formularios, cambiar el idioma.
10. Cerrar la app a mitad de un nivel y reabrir.
11. **Confirmación de correo** (requiere la configuración de `PAGINA_CONFIRMACION.md`): crear una cuenta, abrir el enlace del correo en el móvil y pulsar «Volver a Bitty»: debe abrir la app y mostrar «¡Correo confirmado!» (`com.bitty.app://confirmed`). Con la app desinstalada debe llevar a la web.
12. **Cambiar contraseña** desde Perfil y comprobar que el botón «atrás» vuelve al perfil.

Anota lo que falle (captura + qué pasó) y se corrige.

## Problemas conocidos o por vigilar

- **Banner y barra inferior:** el banner de AdMob es una vista nativa sobre la web. Antes su margen era un 72 fijo y la barra de navegación mide ~73 px (y crece con el tamaño de letra del móvil), así que la tapaba. Ahora el margen se calcula con el alto real de la barra (`adMargin()` en `www/index.html`) + 6 px de hueco, se recalcula al girar o cambiar el tamaño de letra, y el contenido deslizable reserva el espacio del banner (`--adh`). `ADS.bannerMargin = 80` es solo el respaldo. Verificado con la barra medida en un navegador real y con pruebas; **sin ver el resultado en un móvil físico**.
- La APK contiene la web empaquetada: un cambio en la web exige una APK nueva. La web de GitHub Pages sí se actualiza sola con cada `push`.
- Los enlaces de los correos abren la web publicada en el navegador, no la app (no hay *deep links* configurados). Para recuperar contraseña funciona; el usuario luego inicia sesión en la app.
- La sesión (incluido el token de renovación) se guarda en el almacenamiento local privado de la app. Un almacén cifrado por el sistema requeriría un plugin nativo adicional.
