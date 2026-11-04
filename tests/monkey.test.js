// Prueba «mono»: pulsa al azar los controles de la app durante miles de pasos (semillas fijas, reproducible)
// buscando excepciones, estados absurdos (NaN, [object], XP negativo) y bloqueos. Modo invitado, sin red.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const HTML = fs.readFileSync(process.argv[2] || "www/index.html", "utf8")
  .replace(/const SB={[^}]*};/, 'const SB={url:"https://abc.supabase.co",key:"k".repeat(30)};')
  .replace(/<link[^>]*fonts.googleapis[^>]*>/g, "");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const SEEDS = [11, 202, 3033, 40404, 505050], STEPS = +process.env.MONKEY_STEPS || 1200;
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };

async function run(seed) {
  const rnd = mulberry(seed), errs = [], vc = new VirtualConsole();
  vc.on("jsdomError", e => errs.push((e.detail && e.detail.message) || e.message));
  vc.on("error", (...a) => errs.push("console.error: " + a.join(" ")));
  const dom = new JSDOM(HTML, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "http://localhost/",
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
      w.Element.prototype.scrollIntoView = () => {};
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {} }));
      w.Math.random = rnd;                       // preguntas reproducibles
      w.localStorage.setItem("bitty_guest", "1");
      w.localStorage.setItem("bitty", JSON.stringify({ v: 2, name: "Ana", lang: ["es", "en", "nl"][seed % 3], dif: seed % 3, xp: 0, done: {}, sp: [] }));
      w.fetch = async () => { throw new TypeError("Failed to fetch"); };     // sin red
      w.confirm = () => rnd() < .6; w.alert = () => {}; w.prompt = () => (rnd() < .5 ? "" : "ELIMINAR");
      w.addEventListener("unhandledrejection", e => errs.push("promesa sin capturar: " + (e.reason && e.reason.message)));
    } });
  const w = dom.window, d = w.document;
  w.addEventListener("error", e => errs.push("error: " + e.message));
  await sleep(500);
  const screens = new Set(); let clicks = 0, typed = 0, bad = [];
  for (let i = 0; i < STEPS; i++) {
    const visible = e => { for (let x = e; x && x.nodeType === 1; x = x.parentElement) if (x.style && x.style.display === "none") return false; return true; };   // un usuario no puede pulsar lo oculto
    const els = [...d.querySelectorAll("#app [onclick], #app button, nav button, #app .opt, #app .chip, #app input")].filter(e => !e.disabled && visible(e));
    if (!els.length) { bad.push("sin controles en el paso " + i); break; }
    const e = els[Math.floor(rnd() * els.length)];
    try {
      if (e.tagName === "INPUT") { e.value = ["", "x", "Ana", "a@b.com", "123456", "<b>x</b>", "A".repeat(200)][Math.floor(rnd() * 7)]; typed++; e.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); }
      else { e.click(); clicks++; }
    } catch (x) { errs.push("excepción al pulsar " + (e.getAttribute("onclick") || e.className) + ": " + x.message); }
    if (i % 5 === 0) await sleep(0);
    const t = (d.querySelector("#app") || d.body).textContent;
    screens.add((d.querySelector("#app h1,#app h2") || { textContent: "?" }).textContent.slice(0, 24));
    if (/\[object |undefined undefined/.test(t)) { bad.push("texto corrupto ([object …]) en el paso " + i); break; }
    const nums = [...d.querySelectorAll("#app .tile, #app .stars, #app .rup, nav, #app .top, #app .hud")].map(x => x.textContent).join(" ");
    if (/NaN|Infinity/.test(nums)) { bad.push("NaN/Infinity en un contador en el paso " + i + ": " + nums.slice(0, 80)); break; }
    const S = JSON.parse(w.eval("JSON.stringify(S)"));
    if (!(Number.isFinite(S.xp) && S.xp >= 0) || !(Number.isFinite(S.streak) && S.streak >= 0) || !Array.isArray(S.hist) || ![0, 1, 2].includes(S.dif)) { bad.push(`estado absurdo en el paso ${i}: xp=${S.xp} racha=${S.streak} dif=${S.dif}`); break; }
    if (errs.length) break;
  }
  w.close();
  return { errs, bad, clicks, typed, screens: screens.size };
}

(async () => {
  let totalClicks = 0;
  for (const seed of SEEDS) {
    const r = await run(seed);
    totalClicks += r.clicks + r.typed;
    ok(r.errs.length === 0, `semilla ${seed}: errores durante la ejecución: ${JSON.stringify(r.errs.slice(0, 3))}`);
    ok(r.bad.length === 0, `semilla ${seed}: ${r.bad.join("; ")}`);
    console.log(`  semilla ${seed}: ${r.clicks} pulsaciones, ${r.typed} entradas de texto, ${r.screens} pantallas distintas`);
  }
  console.log(`monkey.test: ${n - fails}/${n} comprobaciones correctas · ${totalClicks} acciones aleatorias`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
