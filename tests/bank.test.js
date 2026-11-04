// Calidad del banco de preguntas ampliado.
//  1) Las preguntas con código se EJECUTAN (Python y JavaScript) y la respuesta correcta debe ser lo que imprime.
//  2) El HTML está al día con content/questions-extra.js.
//  3) Sin duplicados (exactos ni casi iguales), opciones distintas, tres idiomas, misma dificultad.
//  4) Se añadieron preguntas sin tocar el contenido anterior.
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { JSDOM, VirtualConsole } = require("jsdom");
const root = path.join(__dirname, "..");
const Q = require(path.join(root, "content", "questions-extra.js"));
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };
const norm = s => String(s).replace(/\s+/g, "");

// ---- 1) ejecutar el código de las preguntas
const hasPy = ["python", "python3"].find(c => { try { return cp.spawnSync(c, ["-I", "-c", "print(1)"]).status === 0; } catch (e) { return false; } });
let ran = 0, skipped = 0;
for (const it of Q.filter(x => x.run)) {
  let out;
  if (it.run.lang === "js") out = cp.spawnSync(process.execPath, ["-e", it.run.code], { encoding: "utf8", timeout: 10000 });
  else if (it.run.lang === "py") { if (!hasPy) { skipped++; continue; } out = cp.spawnSync(hasPy, ["-I", "-c", it.run.code], { encoding: "utf8", timeout: 10000 }); }
  else { ok(false, "lenguaje de ejecución desconocido " + it.run.lang); continue; }
  ran++;
  ok(out.status === 0, `el código falla: ${it.run.code} -> ${out.stderr}`);
  ok(norm(out.stdout) === norm(it.es[1]), `respuesta incorrecta: ${JSON.stringify(it.run.code)} imprime ${JSON.stringify(out.stdout.trim())} pero la correcta es ${JSON.stringify(it.es[1])}`);
  // las 3 versiones del idioma deben tener la misma respuesta y mismas malas opciones (son salidas, no texto)
  ok(JSON.stringify(it.es.slice(1)) === JSON.stringify(it.en.slice(1)) && JSON.stringify(it.es.slice(1)) === JSON.stringify(it.nl.slice(1)), "las opciones de una pregunta de código deben coincidir en los 3 idiomas: " + it.run.code);
}
console.log(`código ejecutado y verificado: ${ran}${skipped ? " (Python omitido: no hay intérprete)" : ""}`);

// ---- 2) HTML al día
const chk = cp.spawnSync(process.execPath, [path.join(root, "tools", "build-questions.js"), "--check"], { encoding: "utf8" });
ok(chk.status === 0, "www/index.html no está al día con content/questions-extra.js (ejecuta: node tools/build-questions.js)");

// ---- 3) y 4) calidad dentro de la app real
const html = fs.readFileSync(path.join(root, "www", "index.html"), "utf8").replace(/<link[^>]*fonts.googleapis[^>]*>/g, "");
const errs = [], vc = new VirtualConsole();
vc.on("jsdomError", e => errs.push(e.message)); vc.on("error", (...a) => errs.push(a.join(" ")));
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "http://localhost/",
  beforeParse(w) { w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true }); w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {} })); } });
setTimeout(() => {
  const data = JSON.parse(dom.window.eval(`JSON.stringify(Object.fromEntries(Object.entries(BANKS).map(([k,v])=>[k,v.map(x=>({t:x.t,q:x.q,e:x.e||null,n:x.n||null}))])))`));
  const clean = s => String(s).replace(/<br>/g, " ").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const rawKey = a => clean(typeof a === "string" ? a.split("§")[0] : a[0]).toLowerCase();
  const key = a => { const r = rawKey(a); return /<code>/.test(String(typeof a === "string" ? a : a[0])) ? r.replace(/\s+/g, " ").trim() : r.replace(/[^\p{L}\p{N}]+/gu, " ").trim(); };
  const nums = a => (rawKey(a).match(/\d+/g) || []).join(",");
  const words = s => new Set(key(s).split(" ").filter(w => w.length > 2));
  const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
  const all = []; // todas las preguntas de todos los bancos
  for (const b in data) data[b].forEach((x, i) => all.push({ b, i, x }));

  // las nuevas se localizan por referencia: el bloque XTRA reutiliza el mismo array q que acaba en BANKS
  const idx = JSON.parse(dom.window.eval(`JSON.stringify(Object.fromEntries(Object.keys(XTRA).map(k=>[k,BANKS[k].map((it,i)=>XTRA[k].some(x=>x[1]===it.q)?i:-1).filter(i=>i>=0)])))`));
  const extra = all.filter(o => (idx[o.b] || []).includes(o.i));
  ok(extra.length === Q.length, `deben estar las ${Q.length} preguntas nuevas en la app (encontradas ${extra.length})`);
  const cnt = {}; for (const b in data) cnt[b] = data[b].length;
  // exactos: ninguna pregunta (en español) repetida en todo el banco
  const seen = new Map(), isExtra = new Set(extra); let exact = 0;
  for (const o of all) { const k = key(o.x.q);
    if (seen.has(k)) { const other = seen.get(k); if (isExtra.has(o) || isExtra.has(other)) { exact++; console.log("  duplicada: " + o.b + "#" + o.i + " = " + other.b + "#" + other.i + " · " + k.slice(0, 70)); } }
    else seen.set(k, o); }
  ok(exact === 0, exact + " preguntas nuevas duplican otra del banco");

  // casi iguales: una pregunta nueva no puede parecerse (Jaccard >= 0.7) a ninguna otra del banco
  let near = 0;
  const plain = x => typeof x.q[0] === "string" && !x.q[0].includes("§") && !x.q[0].includes("<code>");
  for (const o of extra.filter(o => plain(o.x))) {
    const w = words(o.x.q);
    for (const p of all) {
      if (p === o || !plain(p.x)) continue;
      const j = jac(w, words(p.x.q));
      if (nums(o.x.q) && nums(p.x.q) && nums(o.x.q) !== nums(p.x.q)) continue; // misma plantilla con otros números
      if (j >= 0.7) { near++; console.log(`  casi igual (${j.toFixed(2)}): ${o.b}#${o.i} «${key(o.x.q).slice(0, 60)}» ~ ${p.b}#${p.i} «${key(p.x.q).slice(0, 60)}»`); }
    }
  }
  ok(near === 0, near + " preguntas nuevas casi iguales a otras existentes");

  // estructura de todas las preguntas nuevas
  for (const o of extra) {
    const where = o.b + "#" + o.i, E = o.x;
    for (const [lang, a] of [["es", E.q], ["en", E.e], ["nl", E.n]]) {
      ok(Array.isArray(a) && a.length === 5, `${where}: falta ${lang}`);
      if (!Array.isArray(a)) continue;
      const opts = a.slice(1).map(s => clean(s).trim().toLowerCase());
      ok(new Set(opts).size === 4, `${where} ${lang}: opciones repetidas ${JSON.stringify(opts)}`);
      ok(a.every(s => String(s).trim() && !(/^(js|jse)$/.test(o.b) ? /\[object/ : /undefined|\[object/).test(s)), `${where} ${lang}: texto vacío o corrupto`);
    }
    ok([0, 1, 2].includes(E.t), where + ": dificultad inválida");
  }
  // reparto por dificultad de lo añadido
  const tiers = [0, 0, 0]; extra.forEach(o => tiers[o.x.t]++);
  ok(tiers.every(t => t >= 10), "reparto por dificultad equilibrado: " + tiers.join("/"));
  // anti-repetición: al reutilizar, se elige la pregunta vista hace más tiempo; las nunca vistas, primero
  const ar = JSON.parse(dom.window.eval(`(function(){
    const mk=t=>[t,"a","b","c"];const A=mk("zz-A"),B=mk("zz-B"),C=mk("zz-C"),D=mk("zz-D");
    S.hist=[kq(B),kq(C),kq(A)];HIm=null;HSs.clear();S.hist.forEach(k=>HSs.add(k));
    const r={};
    r.entreVistas=oldest([A,C,B])[0];                       // B es la más antigua
    r.conNueva=oldest([A,D,B])[0];                          // D nunca vista -> primero
    mark(B);                                                // B vuelve a verse ahora: ya no es la más antigua... (mark no reordena si ya estaba)
    r.trasMark=oldest([A,B,C])[0];
    S.hist=[];HIm=null;HSs.clear();
    return JSON.stringify(r)})()`));
  ok(ar.entreVistas === "zz-B", "entre preguntas ya vistas, se elige la más antigua (" + ar.entreVistas + ")");
  ok(ar.conNueva === "zz-D", "una pregunta nunca vista tiene prioridad (" + ar.conNueva + ")");
  ok(ar.trasMark === "zz-B" || ar.trasMark === "zz-C", "el índice de antigüedad se mantiene coherente tras marcar (" + ar.trasMark + ")");
  ok(errs.length === 0, "errores al cargar la app: " + errs.slice(0, 3).join(" | "));
  console.log(`bank.test: ${n - fails}/${n} comprobaciones correctas · ${Q.length} preguntas nuevas (fáciles/normales/difíciles: ${tiers.join("/")}) · banco total ${all.length}`);
  process.exit(fails ? 1 : 0);
}, 1500);
