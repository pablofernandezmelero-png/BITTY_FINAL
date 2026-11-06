# Validación de Bitty en un Android real (emulador)

Hasta ahora todo lo de Android estaba probado con un Capacitor simulado. El **5 de noviembre de 2026** se probó la APK firmada `build-1004` en un **emulador de Android 16 (API 36, x86_64, con Google Play)**: un Android de verdad, con su WebView, su AdMob nativo y su instalador de paquetes. **No es un móvil físico** (no cubre rendimiento real, el teclado de un móvil, ni la firma de Google Play Protect de un equipo real), pero es la primera prueba fuera de simulacros.

## Qué se comprobó y resultado

| Prueba | Resultado | Evidencia |
|---|---|---|
| La APK firmada se instala | **Correcto**. `com.bitty.app`, versionCode 1004, firma esquema v2 | `adb install`, `dumpsys package` |
| La app arranca y muestra la bienvenida | **Correcto** | `docs/evidencias/apk-firmada-arranque-android16.png` |
| Flujo de invitado: nombre, aviso «esto es una demo», elegir modo y ruta | **Correcto** | capturas durante la prueba |
| Pantalla de inicio con la barra inferior (Ruta / Especial / Perfil) | **Correcto** | |
| Formulario de consentimiento de anuncios (UMP) | **Aparece** al llegar al inicio; se puede rechazar | |
| Banner de AdMob (anuncio de prueba 320×50) | **Aparece** encima de la barra inferior | |
| **Solapamiento del banner con la barra de navegación** | **Reproducido en la `build-1004`**: con letra del sistema al 150 % el banner tapaba la parte alta de los tres botones. Causa: margen fijo de 72 px frente a una barra que mide ~73 px y crece con la letra | `docs/evidencias/banner-ANTES-build1004-letra150.png` |
| **Arreglo del solapamiento** (margen = alto real de la barra + 6 px) | **Correcto** con letra al 150 % y al 200 %: banner encima, barra completa y visible | `banner-DESPUES-arreglo-letra150.png`, `banner-DESPUES-arreglo-letra200.png` |

**Cómo se probó el arreglo sin Gradle:** en este equipo Gradle no puede abrir conexiones locales (`Unable to establish loopback connection`), así que no se pudo compilar una APK nueva. Se tomó la APK `build-1004`, se sustituyó solo `assets/public/index.html` por la web nueva, se alineó (`zipalign`) y se firmó con una **clave de prueba desechable** (no la de Bitty) para instalarla en el emulador. La parte nativa (WebView, plugin de AdMob, banner) es la real. **Esa APK de prueba no se ha publicado ni sirve para distribuir**; la corrección llegará a los usuarios con la próxima APK firmada oficial (la compila GitHub).

## Qué NO cubre esta prueba

- Un móvil físico (otros fabricantes, pantallas, muescas y barras de gestos). El margen se calcula con el alto real de la barra, así que debe adaptarse, pero solo se ha visto en un emulador.
- **Actualizar encima de una versión anterior** (misma firma y versión mayor): requiere una segunda APK firmada con la clave de Bitty. La regla de Android es conocida y la clave coincide, pero no se ha ejecutado.
- Anuncios reales (solo anuncios de prueba de Google), compras, notificaciones.
- Registro con correo real, 2FA con Supabase real, sincronización con la nube: no se probaron en el emulador.

## Cómo repetir la prueba

Requisitos: Android Studio (trae el emulador, `adb` y `apksigner`) y una imagen del sistema `system-images;android-36;google_apis_playstore;x86_64`. Con las herramientas de línea de comandos se crea el dispositivo con `avdmanager`; en este equipo no estaban instaladas y se creó a mano el archivo del dispositivo.

```bash
emulator -avd bitty_test -no-snapshot -gpu swiftshader_indirect
adb install -r Bitty.apk
adb shell monkey -p com.bitty.app -c android.intent.category.LAUNCHER 1
adb shell settings put system font_scale 1.5     # letra grande: el caso que solapaba
adb shell screencap -p /sdcard/s.png && adb pull /sdcard/s.png
```
