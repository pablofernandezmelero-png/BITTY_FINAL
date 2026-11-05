# Bitty en iPhone (PWA instalable)

Bitty se puede **instalar en un iPhone como aplicación** sin App Store: es la misma web publicada en GitHub Pages, con manifiesto, icono propio y *service worker* para abrirse sin conexión. Una app nativa de iOS no se puede compilar ni probar desde Windows (ver el final).

## Cómo instalarla (para el jugador)

1. Abre **Safari** (tiene que ser Safari; en iOS las demás apps de navegador no instalan webs) en `https://pablofernandezmelero-png.github.io/BITTY_FINAL/`.
2. Pulsa **Compartir** (cuadrado con flecha) → **Añadir a pantalla de inicio** → **Añadir**.
3. Abre Bitty desde el icono nuevo: se ve a pantalla completa, sin barra de Safari.

Requisitos: iOS 16.4 o superior recomendado (antes también funciona, pero con menos funciones PWA).

## Qué incluye

| Pieza | Archivo | Detalle |
|---|---|---|
| Manifiesto | `www/manifest.webmanifest` | `standalone`, rutas relativas (vale en `/BITTY_FINAL/` y en un dominio propio), iconos 192/512 normales y *maskable* |
| Iconos | `www/icons/` | `apple-touch-icon.png` 180×180 **sin transparencia** (iOS rellena de negro lo transparente), favicon 32, 192, 512 |
| Etiquetas iOS | cabecera de `www/index.html` | `apple-mobile-web-app-capable`, título, barra de estado, `viewport-fit=cover` (zona segura con muesca) |
| Sin conexión | `www/sw.js` | Red primero (siempre la versión nueva si hay conexión); sin conexión, la última copia guardada |
| CSP | `index.html` | Añadidos solo `manifest-src 'self'`, `worker-src 'self'` e `img-src 'self'`; sigue `default-src 'none'` |

Seguridad del service worker (comprobado en `tests/pwa.test.js`): solo intercepta GET del **mismo origen** (Supabase y las fuentes nunca pasan por él ni se guardan), **nunca guarda URLs con `token_hash`, `token`, `code` ni tokens de acceso**, no guarda errores ni respuestas opacas, y borra las cachés de versiones antiguas. No se registra en la app de Android (Capacitor) ni en la de escritorio.

Para publicar una versión nueva de la web no hace falta tocar nada: el service worker es «red primero». Solo si cambias la lista `PRECACHE` de `sw.js`, sube el número de `CACHE` (`bitty-v1` → `bitty-v2`).

## Limitaciones conocidas de iOS (no son fallos de Bitty)

- **Los enlaces del correo se abren en Safari, no en la app instalada.** Tras confirmar el correo, el usuario abre Bitty desde su icono e inicia sesión. El botón «Volver a Bitty» no tiene esquema en iPhone (solo Android `com.bitty.app://` y escritorio `bitty://`) y lleva a la web.
- **Sin anuncios**: AdMob es un plugin nativo de Android; en la PWA no se muestran. El botón de «ver vídeo» de la pantalla de perfil no estará disponible fuera de la app de Android.
- Las **fuentes** (Fredoka/Nunito) vienen de Google Fonts y no se guardan sin conexión: sin red se ve la tipografía del sistema. Autoalojarlas lo arregla (pendiente, requiere descargar los `.woff2`).
- La **sesión** se guarda en el almacenamiento de la app instalada. Si el usuario borra los datos del sitio o desinstala el icono, tendrá que iniciar sesión de nuevo (el progreso está en la nube).
- Instalada como PWA, iOS **no** borra los datos tras 7 días sin uso (esa limpieza de ITP afecta a las pestañas de Safari, no a las apps añadidas a la pantalla de inicio).
- Las notificaciones push no están implementadas.

## Qué se ha comprobado y qué no

Verificado (automático y en Chromium real): manifiesto e iconos con sus dimensiones reales, etiquetas iOS, CSP, registro del service worker en Chromium (Electron) con caché precargada, la app **abre con el servidor apagado**, no se interceptan otros orígenes ni se guardan tokens, y 9 mutaciones del código se detectan.

**No verificado: un iPhone real.** No hay iPhone ni Safari en este entorno. Antes de darlo por bueno, en un iPhone:

1. Instalar como arriba y comprobar que el icono es el robot de Bitty con fondo morado/rosa y sin esquinas negras.
2. Abrir la app instalada: pantalla completa, sin barra de Safari; contenido que no queda tapado por la muesca ni por la barra inferior.
3. Iniciar sesión, jugar un nivel, activar el modo avión y volver a abrir la app: debe cargar y poder jugarse (aviso de «sin conexión»).
4. Quitar el modo avión: el progreso se sincroniza.
5. Registrarse con un correo real, abrir el enlace (Safari), confirmar y volver a la app instalada.

Anota capturas de lo que falle y se corrige.

## Camino nativo de iOS (pendiente de ti; no hecho)

Si algún día se quiere una app en la App Store (o TestFlight) con Capacitor:

- Hace falta un **Mac con Xcode** y una cuenta de **Apple Developer (99 USD/año)**. No se puede compilar desde Windows ni desde GitHub Actions gratuito sin firmar con tus certificados.
- Pasos: `npm i @capacitor/ios`, `npx cap add ios`, `npx cap sync ios`, abrir `ios/App` en Xcode, poner *Bundle Identifier*, equipo de firma e icono (usar `www/icons/icon-512.png` / el SVG de `assets/brand/`), esquema de URL `com.bitty.app` para `com.bitty.app://confirmed`, y archivar.
- AdMob en iOS necesita su propio ID de aplicación de iOS y una Info.plist con `GADApplicationIdentifier` y `NSUserTrackingUsageDescription` (App Tracking Transparency).
- Apple revisa la app: debe tener política de privacidad y descripción de la recogida de datos.
