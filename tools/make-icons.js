// Genera TODOS los iconos de Bitty (Android, Windows, PWA/iPhone y tienda) a partir de la mascota, renderizando SVG con Electron.
//   ELECTRON_BIN=<ruta a electron(.exe)> "$ELECTRON_BIN" tools/make-icons.js --user-data-dir=<carpeta temporal>
// (o  npx electron tools/make-icons.js  desde desktop/ con las dependencias instaladas). Los resultados se guardan en el repositorio.
const { app, BrowserWindow } = require("electron");
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
app.disableHardwareAcceleration();
app.on("window-all-closed", () => {});   // sin esto Electron se cierra al destruir la primera ventana

// ---------- diseño (viewBox 512): robot claro con visor oscuro sobre degradado morado → rosa ----------
const DEFS = '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d4aff"/><stop offset="1" stop-color="#ff4d8d"/></linearGradient></defs>';
const ROBOT = '<rect x="248" y="104" width="16" height="70" rx="8" fill="#f6f3ff"/><circle cx="256" cy="98" r="26" fill="#ffc800"/>' +
  '<rect x="88" y="252" width="34" height="86" rx="17" fill="#cfc6ff"/><rect x="390" y="252" width="34" height="86" rx="17" fill="#cfc6ff"/>' +
  '<rect x="112" y="168" width="288" height="236" rx="76" fill="#f6f3ff"/>' +
  '<rect x="144" y="204" width="224" height="146" rx="60" fill="#1d1450"/>' +
  '<circle cx="214" cy="268" r="27" fill="#5ff3d8"/><circle cx="298" cy="268" r="27" fill="#5ff3d8"/>' +
  '<path d="M214 318 Q256 348 298 318" stroke="#ff7ab0" stroke-width="13" fill="none" stroke-linecap="round"/>';
const robot = s => `<g transform="translate(256 256) scale(${s}) translate(-256 -250)">${ROBOT}</g>`;
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${DEFS}${body}</svg>`;
const V = {
  rounded: svg(`<rect width="512" height="512" rx="112" fill="url(#g)"/>${robot(1)}`),            // icono «normal» (esquinas redondeadas)
  bleed:   svg(`<rect width="512" height="512" fill="url(#g)"/>${robot(0.86)}`),                    // sin esquinas: maskable, iPhone, tienda
  round:   svg(`<circle cx="256" cy="256" r="256" fill="url(#g)"/>${robot(0.86)}`),                 // Android antiguo, circular
  fore:    svg(robot(0.86))                                                                           // primer plano del icono adaptable de Android (fondo transparente)
};

function ico(entries) {          // contenedor ICO con imágenes PNG (admitido desde Windows Vista)
  const n = entries.length, head = Buffer.alloc(6 + 16 * n);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(n, 4);
  let off = head.length;
  entries.forEach((e, i) => { const o = 6 + 16 * i, d = e.size >= 256 ? 0 : e.size; head[o] = d; head[o + 1] = d; head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(e.png.length, o + 8); head.writeUInt32LE(off, o + 12); off += e.png.length; });
  return Buffer.concat([head, ...entries.map(e => e.png)]);
}

async function render(variant, size) {
  const win = new BrowserWindow({ show: false, width: size, height: size, useContentSize: true, frame: false, transparent: true, backgroundColor: "#00000000", webPreferences: { offscreen: false } });
  const html = `<!doctype html><html style="margin:0;background:transparent"><body style="margin:0;background:transparent;overflow:hidden"><img style="display:block;width:${size}px;height:${size}px" src="data:image/svg+xml;base64,${Buffer.from(V[variant]).toString("base64")}"></body></html>`;
  await win.loadURL("data:text/html;base64," + Buffer.from(html).toString("base64"));
  await new Promise(r => setTimeout(r, 250));
  let img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  const s = img.getSize();
  if (s.width !== size || s.height !== size) img = img.resize({ width: size, height: size, quality: "best" });
  const bmp = img.toBitmap();             // BGRA: alfa de la esquina superior izquierda y del centro
  win.destroy();
  return { png: img.toPNG(), cornerAlpha: bmp[3], centerAlpha: bmp[((size >> 1) * size + (size >> 1)) * 4 + 3] };
}
const out = (rel, buf) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); return rel; };

app.whenReady().then(async () => {
  const log = [], facts = {};
  const put = async (variant, size, rel) => { const r = await render(variant, size); log.push(out(rel, r.png)); facts[rel] = { size, cornerAlpha: r.cornerAlpha, centerAlpha: r.centerAlpha }; return r.png; };
  try {
    // PWA / iPhone / navegador
    await put("rounded", 192, "www/icons/icon-192.png");
    await put("rounded", 512, "www/icons/icon-512.png");
    await put("bleed", 192, "www/icons/icon-maskable-192.png");
    await put("bleed", 512, "www/icons/icon-maskable-512.png");
    await put("bleed", 180, "www/icons/apple-touch-icon.png");           // iOS rellena en negro lo transparente: debe ir sin esquinas
    await put("rounded", 32, "www/icons/favicon-32.png");
    // Tienda (Google Play: 512×512, 32 bits)
    await put("bleed", 512, "store/play-icon-512.png");
    // Windows (.ico con varios tamaños)
    const sizes = [16, 24, 32, 48, 64, 128, 256], ent = [];
    for (const s of sizes) { const r = await render("rounded", s); ent.push({ size: s, png: r.png }); }
    log.push(out("desktop/build/icon.ico", ico(ent)));
    log.push(out("desktop/build/icon.png", await (async () => (await render("rounded", 512)).png)()));
    // Android: lanzador clásico, circular y primer plano del icono adaptable
    const D = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
    for (const [d, [l, f]] of Object.entries(D)) {
      await put("rounded", l, `android/app/src/main/res/mipmap-${d}/ic_launcher.png`);
      await put("round", l, `android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`);
      await put("fore", f, `android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`);
    }
    // fondo del icono adaptable (color liso, el degradado va en los iconos clásicos)
    log.push(out("android/app/src/main/res/values/ic_launcher_background.xml", '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#6D4AFF</color>\n</resources>\n'));
    // fuentes del diseño, para poder retocarlas
    for (const [k, v] of Object.entries(V)) log.push(out(`assets/brand/icon-${k}.svg`, v + "\n"));
    fs.writeFileSync(process.env.BITTY_ICONS_OUT || path.join(root, "assets", "brand", "generado.json"), JSON.stringify({ archivos: log.length, facts }, null, 1));
    console.log("Iconos generados: " + log.length + " archivos");
    app.exit(0);
  } catch (e) { console.error(e); app.exit(1); }
});
