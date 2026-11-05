# App de escritorio (Windows, Electron)

Carpeta: `desktop/` (dentro del repositorio actual). Carga **la web actual** (`www/`) y se empaqueta con `electron-builder` como instalador NSIS de Windows (x64).

> **Sobre las carpetas `Bitty-GitHub*` de Descargas:** contienen un proyecto de escritorio **anterior y separado** (`bitty-desktop`, con Electron 39 y una copia **antigua** del `index.html`, sin cuentas ni sincronización). **No se ha modificado ni usado como base de nada salvo para leer su `main.js` y reutilizar su binario de Electron en una comprobación de solo lectura.** La versión de escritorio del repositorio actual la sustituye: usa la web actual y no hay que mantener dos copias de `index.html`.

## Estado real

| Elemento | Estado |
|---|---|
| Código de la app, seguridad y protocolo propio | Implementado y probado (`tests/desktop.test.js`: 100 comprobaciones; mutaciones: 20/20) |
| Arranque con **Electron real 45.2.3** (ventana oculta): carga, aislamiento, navegación bloqueada, almacenamiento, modo invitado | **Comprobado** (`npm run smoke`, 10/10), sobre código fuente y sobre la app **empaquetada** (`win-unpacked`) |
| Generación del instalador `Bitty-Setup-1.0.0.exe` (NSIS, 116 MB) | **Comprobado localmente**, desde una ruta corta; sin firmar y con el icono por defecto de Electron |
| Ejecutar el **instalador** (instalar, acceso directo, desinstalar) | **No probado**: instalaría software en tu equipo. Lo haces tú (ver más abajo) |
| Workflow de GitHub `desktop-windows.yml` | Escrito y con YAML válido; **no ejecutado** (se lanza a mano tras subir el código) |
| Modo sin conexión en escritorio | La web es local y funciona sin red; **no probado con el cable desconectado** en la app de escritorio |
| Icono propio, firma de código (certificado) y autoactualización | **Pendiente** (no hay icono de Bitty ni certificado; sin `electron-updater`) |

## Cómo está endurecida

- Carga desde un protocolo propio `app://bitty` que sirve **solo archivos de `www/`** (rutas relativas a la app, nunca absolutas). Intentos de salirse de la carpeta (`..`, `%2e%2e`, `\`, NUL, otro host) devuelven 404 o se rechazan.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, `webviewTag: false`; la página **no tiene `require`, `process` ni `module`** (comprobado en la app real).
- `preload.js` expone solo `bittyDesktop = { isDesktop, platform, onDeepLink }` (objeto congelado), sin `ipcRenderer`.
- **Navegación bloqueada**: solo se navega dentro de `app://bitty`; los enlaces externos se abren en el navegador **únicamente** si son `https` hacia la web publicada de Bitty (lista blanca en `desktop/security.js`), sin credenciales en la URL; las ventanas nuevas se deniegan.
- **Permisos denegados** (cámara, micrófono, ubicación, notificaciones…): Bitty no usa ninguno.
- Sin menú de aplicación; DevTools solo al desarrollar (no en la app empaquetada); instancia única.
- Enlace profundo `bitty://confirmed` (solo avisa de «¡Correo confirmado!»; sin parámetros ni tokens). Se registra en el sistema **solo en la app instalada** (el instalador NSIS también lo hace), nunca al desarrollar ni en las pruebas.
- Contenido de la web: la misma CSP restrictiva que en el resto de plataformas (`connect-src https://*.supabase.co`).

### Versión de Electron
Se usa **Electron 45.2.3**. Las 39.x tienen avisos de seguridad de gravedad **alta** corregidos en la 45.2.3 (p. ej. herencia de restricciones de *sandbox* en ventanas emergentes, lectura entre orígenes en manejadores de protocolo, permisos atribuidos al origen equivocado). En Bitty la exposición era baja (no hay ventanas emergentes ni `webview` y el protocolo es propio), pero se actualizó y se **probó la versión que se publica**. `npm audit` de `desktop/`: 0 altas; 6 moderadas, todas en `electron-builder`/`minimatch` (herramienta de compilación que **no se incluye** en la app; denegación de servicio con patrones de ruta hostiles, sin riesgo en una compilación con entrada propia).

## Compilar

### En GitHub (recomendado, no necesitas nada instalado)
1. Sube el código (necesita tu autorización) y entra en **Actions → Build Bitty Desktop (Windows) → Run workflow**.
2. El workflow ejecuta las pruebas de escritorio, arranca Electron de verdad (`npm run smoke`) y genera el instalador.
3. Descarga **Bitty-Windows-Installer** (zip con `Bitty-Setup-1.0.0.exe`) de *Artifacts*.

### En tu equipo
Requisitos: Node 22 y **una carpeta con ruta corta**.

```bash
cd desktop
npm ci
npm run smoke      # comprueba la app con Electron real (ventana oculta)
npm start          # abre la app (copia ../www a desktop/www)
npm run dist       # genera dist/Bitty-Setup-1.0.0.exe
```

> **Rutas largas en Windows:** el límite de 260 caracteres hace que Electron falle con `Error loading V8 startup snapshot file` y que Gradle/electron-builder fallen si el proyecto está en una ruta muy larga. Usa algo como `C:\bitty`.

### Por qué ya no hace falta lo de «extraer electron.exe de la caché»
El plan menciona reinstalar Electron y extraer `electron.exe` a mano. Era un problema de **Electron 39 con npm 11**: npm moderno **bloquea por defecto los scripts de instalación** (`allowScripts`) y el binario de Electron 39 se descargaba justo en uno de ellos. **Electron 45 descarga su binario de forma perezosa** la primera vez que se usa (`require("electron")` o `electron .`), así que `npm ci` + `npm start` bastan. Si alguna vez falta el binario: `node node_modules/electron/install.js`.

## Probar el instalador (lo haces tú)
1. Ejecuta `Bitty-Setup-1.0.0.exe` (Windows puede avisar con SmartScreen porque **no está firmado**).
2. Comprueba: instala, crea el acceso directo del escritorio y del menú Inicio, abre Bitty.
3. Juega un nivel, ciérralo y vuelve a abrirlo: el progreso debe seguir.
4. Desconecta la red y comprueba que se puede seguir jugando.
5. Desde un enlace de confirmación de correo, pulsa «Abrir la app de escritorio»: debe abrir Bitty con el aviso «¡Correo confirmado!».
6. Desinstala desde *Configuración → Aplicaciones*.

## Pendiente
- Icono de Bitty (`build.win.icon`, `.ico` de 256×256) y, si se publica fuera de GitHub, **certificado de firma de código** (sin él, SmartScreen avisará).
- Autoactualización (`electron-updater`): hoy cada versión nueva requiere un instalador nuevo.
- El progreso de la app de escritorio **no se comparte** con el de la web ni con el de Android salvo iniciando sesión con la misma cuenta (cada plataforma guarda el suyo en local).
