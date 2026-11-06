// Política de privacidad (/privacidad/): contenido en 3 idiomas, seguridad de la página y coherencia con lo que la app hace de verdad.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const page = fs.readFileSync(path.join(root, "www", "privacidad", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "www", "index.html"), "utf8");
const dl = fs.readFileSync(path.join(root, "www", "descargar", "index.html"), "utf8");
const manifest = fs.readFileSync(path.join(root, "android", "app", "src", "main", "AndroidManifest.xml"), "utf8");

const load = lang => {
  const errs = [];
  const vc = new VirtualConsole(); vc.on("jsdomError", e => errs.push(e.message));
  const dom = new JSDOM(page, { runScripts: "dangerously", url: "https://pablofernandezmelero-png.github.io/BITTY_FINAL/privacidad/", virtualConsole: vc, beforeParse(w) { Object.defineProperty(w.navigator, "language", { value: lang, configurable: true }); w.fetch = () => { throw new Error("la página no debe hacer peticiones"); }; } });
  return { w: dom.window, errs };
};

(async () => {
  // ---- seguridad de la propia página
  const csp = (page.match(/Content-Security-Policy" content="([^"]*)"/) || [])[1] || "";
  ok(/default-src 'none'/.test(csp) && !/connect-src|unsafe-eval|http/.test(csp.replace(/https:\/\/github\.com[^;]*/g, "")), "CSP estricta: sin conexiones de red ni eval");
  ok(!/<script[^>]+src=|<link[^>]+href="https?:|<img[^>]+src="https?:|@import|url\(http/.test(page), "la página no carga nada de fuera (sin scripts, estilos ni imágenes externas)");
  ok(/name="referrer" content="no-referrer"/.test(page), "sin referer");
  ok(!/eval\(|document\.write|new Function/.test(page), "sin eval ni document.write");

  // ---- contenido en los 3 idiomas
  const SECCIONES = ["es", "en", "nl"].map(l => [l, null]);
  const counts = {};
  for (const [lang, key] of [["es-ES", "es"], ["en-US", "en"], ["nl-NL", "nl"]]) {
    const { w, errs } = load(lang); await sleep(60);
    const d = w.document, text = d.querySelector("#doc").textContent;   // solo el texto visible (el <body> también contiene el código)
    counts[key] = d.querySelectorAll("#doc section").length;
    ok(d.documentElement.lang === key && counts[key] >= 13 && errs.length === 0, `${key}: se muestra en su idioma con ${counts[key]} apartados y sin errores`);
    ok(d.querySelectorAll("#doc table tr").length === 6, `${key}: tabla de datos tratados (cabecera + 5 filas)`);
    for (const prov of ["Supabase", "GitHub", "Google Fonts", "AdMob"]) ok(text.includes(prov), `${key}: nombra a ${prov}`);
    ok(!/undefined|null|\[object/.test(text), `${key}: sin textos rotos`);
    ok(d.querySelectorAll("#doc a").length === 1 && /github\.com\/pablofernandezmelero-png\/BITTY_FINAL\/issues/.test(d.querySelector("#doc a").href) && /noopener/.test(d.querySelector("#doc a").rel), `${key}: único enlace externo = incidencias del repositorio, con noopener`);
    ok(/Perfil|Profile|Profiel/.test(text) && /(Eliminar mi cuenta|Delete my account|Mijn account en gegevens verwijderen)/.test(text), `${key}: indica dónde eliminar la cuenta`);
    ok(/Pendiente|Pending|Nog te doen/.test(text), `${key}: marca con honestidad lo que el responsable debe completar (contacto y público objetivo)`);
  }
  ok(counts.es === counts.en && counts.en === counts.nl, "los 3 idiomas tienen los mismos apartados");
  const { w } = load("es-ES"); await sleep(60);
  w.document.querySelector('.lang button[data-l="en"]').click();
  ok(w.document.documentElement.lang === "en" && /Privacy policy/.test(w.document.querySelector("#h1").textContent), "el selector de idioma funciona");

  // ---- coherencia: lo que dice la política es lo que hace la app
  ok(/fonts\.googleapis\.com/.test(app) && /Google Fonts/.test(page), "la política menciona Google Fonts porque la app los carga");
  ok(/https:\/\/api\.github\.com/.test(app) && /GitHub/.test(page), "la política menciona GitHub porque la app consulta su API");
  ok(/android:allowBackup="false"/.test(manifest) && /copia de seguridad automática está desactivada/.test(page), "«copia de seguridad desactivada en Android» es cierto (allowBackup=false)");
  ok(/delete_my_account/.test(app) && /Eliminar mi cuenta y mis datos/.test(app), "existe el botón y la función de eliminar cuenta que la política cita");
  ok(/ca-app-pub-3940256099942544/.test(app) && /anuncios de prueba/.test(page), "la política dice que ahora se usan anuncios de prueba (es cierto: IDs de prueba de Google)");
  ok(!/analytics|gtag|fbq|googletagmanager|sentry|mixpanel/i.test(app + dl), "«sin analítica propia ni cookies de seguimiento» es cierto (no hay código de analítica)");

  // ---- enlaces desde la app y la página de descargas
  const jsd = new JSDOM(app.replace(/const SB={[^}]*};/, 'const SB={url:"https://abc.supabase.co",key:"k".repeat(30)};').replace(/<link[^>]*fonts.googleapis[^>]*>/g, ""), { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/", virtualConsole: new VirtualConsole(),
    beforeParse(x) { x.Element.prototype.scrollIntoView = () => {}; Object.defineProperty(x.navigator, "language", { value: "es-ES", configurable: true }); x.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true }); x.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) }); x.localStorage.setItem("bitty_guest", "1"); } });
  await sleep(300);
  jsd.window.eval('AS=0;S.name="Test";S.track="g";S.last=new Date().toISOString().slice(0,10);tab="p";home()'); await sleep(100);
  const L = jsd.window.document.querySelector("#privL");
  ok(L && L.href === "https://pablofernandezmelero-png.github.io/BITTY_FINAL/privacidad/" && L.target === "_blank" && /noopener/.test(L.rel), "el Perfil de la app enlaza a la política (constante, pestaña nueva, noopener)");
  ok(/Política de privacidad/.test(L.textContent), "el enlace del Perfil está traducido");
  ok(/id="pv" href="\.\.\/privacidad\/"/.test(dl) && /pv:"Política de privacidad"/.test(dl) && /pv:"Privacy policy"/.test(dl) && /pv:"Privacybeleid"/.test(dl), "la página de descargas enlaza a la política en los 3 idiomas");
  ok(fs.existsSync(path.join(root, "www", "privacidad", "index.html")), "la política está dentro de www (se publica con la web y entra en la app)");

  console.log(`privacy.test: ${n - fails}/${n} comprobaciones correctas`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
