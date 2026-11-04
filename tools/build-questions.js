// Genera el bloque XTRA de www/index.html a partir de content/questions-extra.js.
//   node tools/build-questions.js          -> escribe el bloque (idempotente)
//   node tools/build-questions.js --check  -> no escribe; falla si el HTML no está al día
// El bloque se inserta justo ANTES del comentario "// id de pregunta independiente del idioma", es decir,
// después de los bancos y del bucle FACTS: así los índices de las preguntas que ya existían no cambian
// (los historiales guardados siguen apuntando a las mismas preguntas).
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "www", "index.html");
const Q = require(path.join(root, "content", "questions-extra.js"));
const BANKS = ["cmp", "hw", "bin", "os", "net", "web", "alg", "ds", "db", "sec", "git", "ai", "pro", "py", "pye", "js", "jse", "jv", "jve"];

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Solo se permite <br> en el enunciado (lo demás se escapa).
const stem = s => s.split("<br>").map(esc).join("<br>");
const codeHtml = c => "<code>" + c.split("\n").map(esc).join("<br>") + "</code>";

function render(item) {
  const out = {};
  for (const l of ["es", "en", "nl"]) {
    const a = item[l];
    if (!Array.isArray(a) || a.length !== 5 || a.some(x => typeof x !== "string" || !x.trim())) throw new Error(`${item.b}: ${l} debe tener enunciado + 4 opciones: ${JSON.stringify(a)}`);
    if (a.some(x => x.includes("|") || x.includes("§"))) throw new Error(`${item.b}: caracteres reservados (| §) en ${JSON.stringify(a)}`);
    let t = stem(a[0]);
    if (item.run) t = t.replace("{code}", codeHtml(item.run.code));
    if (t.includes("{code}")) throw new Error(`${item.b}: {code} sin run`);
    out[l] = [t, ...a.slice(1).map(esc)];
  }
  return [item.t, out.es, out.en, out.nl];
}

const by = {};
for (const it of Q) {
  if (!BANKS.includes(it.b)) throw new Error("banco desconocido: " + it.b);
  if (![0, 1, 2].includes(it.t)) throw new Error("dificultad inválida en " + it.b);
  (by[it.b] = by[it.b] || []).push(render(it));
}
const lines = BANKS.filter(b => by[b]).map(b => JSON.stringify(b) + ":[\n" + by[b].map(x => JSON.stringify(x)).join(",\n") + "]");
const block = "/*XTRA:BEGIN*/\n// Preguntas ampliadas (generado desde content/questions-extra.js con tools/build-questions.js; no editar a mano)\n" +
  "const XTRA={\n" + lines.join(",\n") + "};\n" +
  "for(const k in XTRA)XTRA[k].forEach(x=>BANKS[k]&&BANKS[k].push({t:x[0],q:x[1],e:x[2],n:x[3]}));\n/*XTRA:END*/\n";

let html = fs.readFileSync(htmlPath, "utf8");
const crlf = html.includes("\r\n");
let norm = html.replace(/\r\n/g, "\n");
const re = /\/\*XTRA:BEGIN\*\/[\s\S]*?\/\*XTRA:END\*\/\n/;
let next;
if (re.test(norm)) next = norm.replace(re, () => block);
else {
  const marker = "// id de pregunta independiente del idioma";
  if (norm.split(marker).length !== 2) throw new Error("no encuentro el punto de inserción");
  next = norm.replace(marker, () => block + marker);
}
if (process.argv.includes("--check")) {
  if (next !== norm) { console.error("El HTML no está al día: ejecuta node tools/build-questions.js"); process.exit(1); }
  console.log("XTRA al día (" + Q.length + " preguntas)"); process.exit(0);
}
fs.writeFileSync(htmlPath, crlf ? next.replace(/\n/g, "\r\n") : next, "utf8");
console.log("Bloque XTRA escrito: " + Q.length + " preguntas en " + Object.keys(by).length + " bancos");
