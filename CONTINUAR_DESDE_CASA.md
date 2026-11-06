# Continuar con Bitty desde otro equipo (traspaso)

Resumen del estado y de las reglas de trabajo, para retomar el proyecto desde casa o desde cualquier ordenador, con Claude o sin él. **No contiene contraseñas ni claves.** Estado a **6 de noviembre de 2026**.

## 1. Cómo retomarlo en 5 minutos

```bash
git clone https://github.com/pablofernandezmelero-png/BITTY_FINAL.git
cd BITTY_FINAL
npm ci
npm test          # ~2.000 comprobaciones; debe terminar sin fallos
```

- Para trabajar con Claude: abre este repositorio en Claude Code (escritorio, web `claude.ai/code` o terminal) y pídele que lea este archivo, `README.md` y `CHECKLIST_LANZAMIENTO.md`.
- La web es **un solo archivo** (`www/index.html`, JavaScript sin librerías, 3 idiomas es/en/nl). Android usa Capacitor 8 (`android/`), Windows usa Electron 45 (`desktop/`), Supabase es el servidor (`supabase/migrations/`).
- Los documentos del proyecto están en la raíz: `README`, `ACTUALIZACIONES`, `CONFIGURACION_SUPABASE`, `COMPILACION_ANDROID`, `COMPILACION_ESCRITORIO`, `IPHONE`, `PRUEBAS_Y_VALIDACION`, `VALIDACION_ANDROID_EMULADOR`, `AUDITORIA_*`, `INVENTARIO_FUNCIONALIDADES`, `CHECKLIST_LANZAMIENTO`.

## 2. Reglas de trabajo del propietario (se mantienen siempre)

1. **No hacer `push`, publicar Releases, lanzar workflows de publicación ni cambiar configuración externa sin autorización expresa en ese momento.**
2. **No aplicar migraciones en el Supabase real**, no tocar datos reales ni secretos; nunca `service_role` en el cliente; no desactivar RLS.
3. No inventar credenciales, IDs de AdMob ni resultados; distinguir siempre: simulado / local / servicio real / dispositivo físico.
4. Conservar compatibilidad con las instalaciones y el progreso existentes; no reconstruir desde cero.
5. **ACORDARSE SIEMPRE DEL AVISO DE ACTUALIZACIÓN.** Cada cambio de la app solo llega a los usuarios si se **publica una versión nueva** (workflow firmado de Android y el de Windows, con `publish_release`). Sin una Release más nueva, las apps instaladas no avisan. Tras cualquier cambio: mantener el aviso funcionando (`tests/update.test.js`) y recordar al propietario que hay que publicar.
6. Responder en español, guiar paso a paso, explicar con claridad lo que se ha comprobado de verdad y lo que no.

## 3. Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Web publicada | `https://pablofernandezmelero-png.github.io/BITTY_FINAL/` |
| Página de descargas (APK, Windows, iPhone) | `…/BITTY_FINAL/descargar/` |
| Política de privacidad (preliminar) | `…/BITTY_FINAL/privacidad/` |
| Vista previa del aviso de actualización (solo web) | `…/BITTY_FINAL/#probar-aviso` |
| Fuente de versiones | Releases de GitHub: `build-N` (Android firmada, «latest») y `desktop-latest` (Windows, el título lleva `(build N)`) |
| Workflows | `.github/workflows/`: *Build Android Release (firmado)* (oficial), *Build Android APK* (depuración, Release preliminar), *Build Bitty Desktop (Windows)*, *Publicar web (GitHub Pages)* (automático al subir `www/**`) |
| Clave de firma de Android | **Solo** en los 4 *Secrets* del repositorio (`BITTY_KEYSTORE_BASE64`, `BITTY_KEYSTORE_PASSWORD`, `BITTY_KEY_ALIAS`, `BITTY_KEY_PASSWORD`) y en una **copia local del propietario** (carpeta `Bitty-clave-firma` de Descargas, con su `LEEME-IMPORTANTE.txt`). **Hay que llevarse esa carpeta a un sitio seguro (pendrive o gestor de contraseñas): sin ella no se podrán publicar actualizaciones encima de las instaladas.** Huella pública: `71f641f3…c96b`. |
| Supabase | Proyecto `tewlouwqlpjmrifvhrhz`; solo se usa la clave pública (`sb_publishable_…`) |
| Evidencias (capturas de Android real) | `docs/evidencias/` |

## 4. Estado resumido

**Hecho y comprobado de verdad:** repositorio sincronizado; web, descargas y PWA publicadas; APK firmada `build-1004` con la clave de Bitty, instalada y arrancada en un emulador de Android 16; solape del banner de anuncios reproducido y arreglo verificado (emulador); aviso de actualización comprobado en el emulador con la API real de GitHub (aparece, **vuelve a salir sin internet**, «Actualizar ahora» abre la página de descargas); Electron real (arranque, aislamiento, versión por IPC); instalador de Windows con icono; migraciones validadas en un PostgreSQL embebido; ~2.000 comprobaciones y 75 mutaciones detectadas.

**Implementado, sin validar en entorno real:** registro/inicio de sesión/recuperación/cambio de contraseña, confirmación de correo, 2FA, XP seguro, sincronización, eliminar cuenta, PWA de iPhone, política de privacidad.

**Pendiente de acciones del propietario:**
1. **Publicar versión nueva** (el aviso nuevo, el banner arreglado y el enlace de privacidad solo llegan con ella): *Actions → Build Android Release (firmado) → Run workflow* con `publish_release`, y lo mismo con *Build Bitty Desktop (Windows)*.
2. **Supabase:** ejecutar las consultas de solo lectura de `CONFIGURACION_SUPABASE.md` (sección 0), aplicar las migraciones 03–08 en orden (la 04 con la `build-1004` o posterior instalada), configurar *Site URL*, *Redirect URLs*, plantilla «Confirm signup» y activar TOTP, y probar con una cuenta real. **Hasta aplicar la 04 el XP es manipulable en producción.**
3. **Privacidad:** añadir nombre y correo privado de contacto y decidir el público objetivo.
4. **Pruebas físicas:** un móvil Android, un iPhone y el instalador en un Windows limpio.
5. Cuentas de AdMob y Google Play, firma de código de Windows.

**No implementado:** la «versión API de la app» (nunca quedó claro qué era), exportar datos del usuario, actualización automática de escritorio (`electron-updater`), App Links con dominio propio, pantalla de inicio propia, autoalojar las fuentes de Google.

## 5. Cosas que NO viajan con el repositorio

- La **clave de firma** y las contraseñas (ver arriba).
- La sesión de `gh` (GitHub CLI) y los permisos de este equipo: en otro equipo hay que ejecutar `gh auth login` (se abre el navegador; nunca pegues tokens en un chat).
- El **emulador de Android** (`bitty_test`) y el JDK/SDK: en otro equipo, instala Android Studio y crea un dispositivo con la imagen `android-36 / google_apis_playstore / x86_64`; la prueba está descrita en `VALIDACION_ANDROID_EMULADOR.md`. En el equipo usado hasta ahora **Gradle no funcionaba** (`Unable to establish loopback connection`), por eso las APK se compilan en GitHub.
- Windows y rutas largas: Electron y Gradle fallan con rutas de más de 260 caracteres; trabaja desde una carpeta corta (`C:\bitty`).
- En PowerShell, guardar secretos con `gh secret set NOMBRE --body "valor"` (con tubería se añade un salto de línea y `base64 -d` falla).
