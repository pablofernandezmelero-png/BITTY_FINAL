# Actualizaciones y página de descargas

Todo gratis y sin cuentas nuevas: **GitHub Pages** (la web y la página de descargas, 24/7) y **GitHub Releases** (los archivos de la última versión).

## Cómo funciona

```
Tú lanzas el workflow con "publish_release" ──► GitHub Release «build-N» (N = nº de ejecución = versionCode de la APK)
                                                        │
        ┌───────────────────────────────────────────────┤
        ▼                                               ▼
 Página pública  …/BITTY_FINAL/descargar/        La app de Android, al abrirse (máx. 1 vez cada 12 h),
 (botones: APK, Windows, iPhone, web)            pregunta a GitHub cuál es la última «build-N».
                                                 Si N > su versionCode → aviso «Hay una versión nueva» → «Descargar»
                                                 (abre la página /descargar/ en el navegador)
```

- **Android:** el aviso solo aparece en la app nativa, con conexión, fuera de un nivel, y solo avisa (no instala ni descarga solo). «Más tarde» recuerda esa versión y no vuelve a molestar hasta que haya otra más nueva.
- **Web / iPhone (PWA):** no hace falta publicar nada. Cada `push` actualiza GitHub Pages; el service worker es «red primero», y cuando toma el control una versión nueva sale el aviso «Hay una versión nueva» con el botón «Actualizar» (recarga solo si pulsas, por si hay un nivel en curso).
- **Windows:** el instalador se publica en la Release fija `desktop-latest`; la página de descargas lo ofrece. La app de escritorio **no** se auto-actualiza (haría falta `electron-updater` y firma de código).

## Publicar una versión (tú, en GitHub)

1. **Actions → Build Android Release (firmado) → Run workflow**, marcando **publish_release**. Es la versión oficial: firmada con la clave de Bitty (secretos del repositorio), verificada con `apksigner` antes de publicar, numeración 1000 + ejecución (`build-1004`, `build-1005`…) y marcada como «latest»: la que ofrecen la página `/descargar/` y el aviso de la app.
   *Build Android APK* (depuración) con `publish_release` publica una Release **preliminar y nunca «latest»** (`build-6`…): sirve para pruebas y ni la página ni el aviso la ofrecen.
2. Para Windows: **Actions → Build Bitty Desktop (Windows) → Run workflow** con **publish_release**.
3. Comprueba en `https://pablofernandezmelero-png.github.io/BITTY_FINAL/descargar/` que aparece la versión nueva.

Sin marcar `publish_release`, los workflows funcionan como antes (solo suben el archivo como *Artifact*, que requiere iniciar sesión en GitHub).

## Muy importante: la firma de la APK

Android solo deja **actualizar encima** de una app instalada si la nueva APK está firmada con **la misma clave**.

- La APK de **depuración** se firma con una clave que GitHub genera **distinta en cada ejecución**: al «actualizar» Android dirá *«App no instalada»*; hay que **desinstalar la anterior** (el progreso en la nube no se pierde) e instalar la nueva. Sirve para pruebas.
- La APK de **release firmada** (workflow *Build Android Release*, con tu keystore en los 4 secretos) siempre usa tu clave: **esa sí se actualiza encima**. Para actualizaciones de verdad usa ese workflow.

## Seguridad

- El aviso consulta `https://api.github.com/repos/pablofernandezmelero-png/BITTY_FINAL/releases/latest` sin cookies ni referer, con límite de 8 s. La CSP de la app permite solo Supabase y esa API.
- Solo se aceptan etiquetas `build-<número>`; se ignoran borradores y versiones preliminares. El enlace de «Descargar» es una **constante** (la página de descargas): lo que devuelva la API no puede redirigir a otro sitio.
- La página de descargas solo ofrece enlaces que apunten a las Releases de este repositorio (`https://github.com/…/BITTY_FINAL/releases/download/…`), muestra los datos de la API como texto (nunca HTML) y tiene CSP estricta.
- Los workflows usan el token temporal de cada ejecución (`github.token`), con permiso de escritura solo para crear la Release y solo si marcas `publish_release`. Nunca borran ni editan Releases existentes.
- Límite de la API pública de GitHub sin autenticar: 60 consultas/hora por IP; con 1 consulta cada 12 h por dispositivo sobra.

## Pendiente / no verificado

- **No se ha publicado ninguna Release todavía**, así que la página de descargas dirá «Todavía no hay una versión publicada» hasta que lances un workflow con `publish_release`.
- Comprobado con jsdom y simulacros (69 comprobaciones + 16 mutaciones, todas detectadas); **no probado con una actualización real en un móvil**.
- La APK de depuración compilada antes de este cambio tiene `versionCode 1`: el aviso funcionará a partir de la primera APK publicada con este mecanismo.
- Si algún día se quiere un dominio propio, basta con cambiar la constante `UPD.page` y `REPO` en `www/index.html` y `www/descargar/index.html`.
