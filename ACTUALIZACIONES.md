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
                                                 Si N > su versionCode → aviso «¡Hay una nueva versión de Bitty!» → «Actualizar ahora»
                                                 (abre la página /descargar/ en el navegador)
```

- **Android y Windows (el aviso):** en la app nativa, al abrirla y al volver a la pantalla principal, se compara la versión instalada con la última publicada. Si hay una más nueva sale, **arriba** (el banner nativo de AdMob taparía un aviso abajo), «¡Hay una nueva versión de Bitty!» · «Hemos mejorado la aplicación. Actualiza para disfrutar de las novedades.» · «Versión N» · botones **«Actualizar ahora»** (abre la página de descargas ya existente, fuera de la app) y «Más tarde». No sale dentro de un nivel (sale al terminarlo). **Persistencia:** la versión nueva se guarda en el dispositivo (`bitty_upd_n`); «Más tarde» solo oculta el aviso en esa sesión, así que **vuelve a salir al reabrir la app (también sin internet) y pasadas 6 horas con la app abierta**, hasta que se actualice (entonces se borra solo). Consulta a GitHub como mucho cada 12 h. Solo avisa: no descarga ni instala.
- **Web / iPhone (PWA):** no hace falta publicar nada. Cada `push` actualiza GitHub Pages; el service worker es «red primero», y cuando toma el control una versión nueva sale el aviso «Hay una versión nueva» con el botón «Actualizar» (recarga solo si pulsas, por si hay un nivel en curso).
- **Windows:** el instalador se publica en la Release fija `desktop-latest`; la página de descargas lo ofrece. La app de escritorio **avisa** igual que la de Android: su versión es `1.0.N` (N = nº de ejecución del workflow; la lee del instalador por un canal interno seguro) y la Release `desktop-latest` lleva en el título `Bitty para Windows (build N)`. Si N es mayor que el de la instalación, sale «Hay una versión nueva…» y «Descargar» abre la página de descargas en el navegador. **No se auto-actualiza** (no hay descarga ni instalación automática: haría falta `electron-updater` y, para que funcione bien, firma de código). Hasta que se publique con el workflow nuevo, la Release actual no lleva el número en el título y el aviso no sale.

## Automatización (sin tocar el código)

La fuente centralizada de versiones son **las Releases de GitHub**: el workflow firmado publica `build-N` (Android) y el de Windows pone el número en el título de `desktop-latest`. Las apps leen eso. **No hay que editar ningún archivo de la app para anunciar una versión nueva:** basta con publicar la Release con el workflow.

## Probar el aviso sin publicar nada

- **Vista previa en la web (la haces tú, sin instalar nada):** abre `https://pablofernandezmelero-png.github.io/BITTY_FINAL/#probar-aviso` (en el móvil o en el ordenador). Tras un segundo sale el aviso con el diseño real, marcado «Vista previa de prueba: no es una actualización real»; «Actualizar ahora» abre la página de descargas. No consulta GitHub, no guarda nada, y no hace nada en las apps de Android ni de escritorio. *(Solo disponible cuando se publique la web con este cambio.)*
- **Comprobado en un Android real (emulador, 6 de noviembre de 2026):** una APK de prueba que «cree» tener la versión 1 instalada detectó con la **API real de GitHub** la `build-1004`: salió el aviso (`docs/evidencias/aviso-actualizacion-android-1-aparece.png`), **volvió a salir al reabrir la app sin internet** tras cerrarlo (`...-2-vuelve-sin-internet.png`) y «Update now» abrió Chrome en la página de descargas (`...-3-pagina-de-descargas.png`). No se publicó ninguna Release ni se tocó ninguna app instalada.
- **Por qué no se puede probar con tu app instalada ahora:** la `build-1004` lleva el aviso **antiguo** (texto y botón distintos, sin persistencia) y la app de Windows instalada (1.0.0) no lleva aviso. El aviso nuevo llega a los usuarios con la **próxima APK firmada** y el **próximo instalador de Windows**. Para ver el flujo real de punta a punta hacen falta **dos** versiones publicadas: una con el aviso nuevo (para instalarla) y otra más nueva (para que avise).


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
