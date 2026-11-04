// Genera supabase/migrations/06_contenido_datos.sql a partir de la app (www/index.html):
// rutas -> courses, bancos -> categories, niveles -> lessons/exercises, preguntas fijas -> questions/answers.
//   node tools/export-content.js          -> escribe la migración
//   node tools/export-content.js --check  -> falla si la migración no coincide con la app
// La carga es idempotente (on conflict do nothing): se puede ejecutar más de una vez sin duplicar nada.
const fs = require("fs"), path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const root = path.join(__dirname, "..");
const out = path.join(root, "supabase", "migrations", "06_contenido_datos.sql");
const html = fs.readFileSync(path.join(root, "www", "index.html"), "utf8").replace(/<link[^>]*fonts.googleapis[^>]*>/g, "");

// Bancos -> ruta y nombre (es/en/nl). El orden de position es el de la app.
const CATS = [
  ["cmp", "g", ["Computador y componentes", "The computer and its parts", "De computer en zijn onderdelen"]],
  ["hw", "g", ["Hardware", "Hardware", "Hardware"]],
  ["bin", "g", ["Binario y datos", "Binary and data", "Binair en gegevens"]],
  ["os", "g", ["Sistemas operativos", "Operating systems", "Besturingssystemen"]],
  ["net", "g", ["Redes", "Networks", "Netwerken"]],
  ["web", "g", ["Web", "The web", "Het web"]],
  ["alg", "g", ["Algoritmos", "Algorithms", "Algoritmen"]],
  ["ds", "g", ["Estructuras de datos", "Data structures", "Datastructuren"]],
  ["db", "g", ["Bases de datos", "Databases", "Databases"]],
  ["sec", "g", ["Seguridad", "Security", "Beveiliging"]],
  ["git", "g", ["Git y control de versiones", "Git and version control", "Git en versiebeheer"]],
  ["ai", "g", ["Inteligencia artificial", "Artificial intelligence", "Kunstmatige intelligentie"]],
  ["pro", "g", ["Programación", "Programming", "Programmeren"]],
  ["py", "py", ["Python básico", "Python basics", "Python basis"]],
  ["pye", "py", ["Python avanzado", "More Python", "Meer Python"]],
  ["js", "js", ["JavaScript básico", "JavaScript basics", "JavaScript basis"]],
  ["jse", "js", ["JavaScript avanzado", "More JavaScript", "Meer JavaScript"]],
  ["jv", "java", ["Java básico", "Java basics", "Java basis"]],
  ["jve", "java", ["Java avanzado", "More Java", "Meer Java"]]
];
const COURSE_NAMES = { g: ["Conceptos generales", "General concepts", "Algemene concepten"], py: ["Python", "Python", "Python"], js: ["JavaScript", "JavaScript", "JavaScript"], java: ["Java", "Java", "Java"] };

function load() {
  return new Promise(res => {
    const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: new VirtualConsole(), url: "http://localhost/",
      beforeParse(w) { w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true }); } });
    setTimeout(() => {
      const w = dom.window;
      res(JSON.parse(w.eval(`JSON.stringify({
        banks: Object.fromEntries(Object.entries(BANKS).map(([k,v])=>[k,v.map(x=>({t:x.t,q:x.q,e:x.e,n:x.n}))])),
        courses: Object.keys(T).map(k=>({id:k,icon:T[k].e})),
        lessons: Object.fromEntries(Object.keys(T).map(k=>[k,T[k].L.map(l=>({
          es:(S.lang="es",td(l[0])), en:(S.lang="en",td(l[0])), nl:(S.lang="nl",td(l[0])), boss:!!l[2]}))]))
      })`)));
    }, 1500);
  });
}

const sq = s => "'" + String(s).replace(/'/g, "''") + "'";
const orderParts = s => { const [a, b] = s.split("§"); return [a, b.split("|")]; };

(async () => {
  const d = await load();
  const cats = CATS.map(([id, c], i) => ({ id, c, pos: i }));
  for (const c of CATS) if (!d.banks[c[0]]) throw new Error("falta el banco " + c[0]);
  for (const b in d.banks) if (!CATS.find(c => c[0] === b)) throw new Error("banco sin categoría: " + b);
  const courseIds = d.courses.map(c => c.id);

  const qrows = [];
  for (const [bank] of CATS) d.banks[bank].forEach((x, i) => {
    const order = typeof x.q === "string";
    if (order) {
      const [pq, steps] = orderParts(x.q), [pe, se] = orderParts(x.e), [pn, sn] = orderParts(x.n);
      if (steps.length !== se.length || steps.length !== sn.length) throw new Error(`${bank}:${i} orden con distinto nº de pasos`);
      qrows.push({ k: `${bank}:${i}`, c: bank, d: x.t, kind: "order", p: { es: pq, en: pe, nl: pn }, a: steps.map((s, j) => ({ pos: j, ok: true, t: { es: s, en: se[j], nl: sn[j] } })) });
    } else {
      if (!x.e || !x.n || x.q.length !== x.e.length || x.q.length !== x.n.length) throw new Error(`${bank}:${i} falta idioma o distinto nº de opciones`);
      qrows.push({ k: `${bank}:${i}`, c: bank, d: x.t, kind: "choice", p: { es: x.q[0], en: x.e[0], nl: x.n[0] },
        a: x.q.slice(1).map((s, j) => ({ pos: j, ok: j === 0, t: { es: s, en: x.e[j + 1], nl: x.n[j + 1] } })) });
    }
  });

  const J = o => JSON.stringify(o).replace(/\$j\$/g, "$ j $");   // el literal $j$ no puede aparecer dentro
  let sql = `-- Bitty · migración 006: carga del contenido actual de la app en las tablas de contenido
-- GENERADA con \`node tools/export-content.js\` a partir de www/index.html. No editar a mano.
-- Idempotente (on conflict do nothing): se puede ejecutar varias veces sin duplicar nada. No borra nada.
-- Requiere la migración 005. Cursos: ${courseIds.length} · categorías: ${CATS.length} · lecciones: ${courseIds.reduce((a, k) => a + d.lessons[k].length, 0)} · preguntas: ${qrows.length}
-- Contenido en formato HTML tal y como lo muestra la app (por eso aparecen entidades como &lt;).

insert into public.courses (id, position, name, icon)
select x.id, x.pos, x.name, x.icon from jsonb_to_recordset($j$${J(d.courses.map((c, i) => ({ id: c.id, pos: i, icon: c.icon, name: { es: COURSE_NAMES[c.id][0], en: COURSE_NAMES[c.id][1], nl: COURSE_NAMES[c.id][2] } })))}$j$::jsonb)
  as x(id text, pos int, name jsonb, icon text)
on conflict (id) do nothing;

insert into public.categories (id, course_id, position, name)
select x.id, x.course_id, x.pos, x.name from jsonb_to_recordset($j$${J(cats.map(c => ({ id: c.id, course_id: c.c, pos: c.pos, name: { es: CATS[c.pos][2][0], en: CATS[c.pos][2][1], nl: CATS[c.pos][2][2] } })))}$j$::jsonb)
  as x(id text, course_id text, pos int, name jsonb)
on conflict (id) do nothing;

insert into public.lessons (course_id, position, title, is_boss, xp)
select x.course_id, x.pos, x.title, x.boss, case when x.boss then 40 else 10 end
from jsonb_to_recordset($j$${J(courseIds.flatMap(k => d.lessons[k].map((l, i) => ({ course_id: k, pos: i, boss: l.boss, title: { es: l.es, en: l.en, nl: l.nl } }))))}$j$::jsonb)
  as x(course_id text, pos int, title jsonb, boss boolean)
on conflict (course_id, position) do nothing;

insert into public.exercises (lesson_id, position, kind, config)
select l.id, 0, case when l.is_boss then 'boss' else 'quiz' end, '{"source":"generator"}'::jsonb
from public.lessons l
on conflict (lesson_id, position) do nothing;
`;
  const CH = 150;
  for (let i = 0; i < qrows.length; i += CH) {
    const part = qrows.slice(i, i + CH);
    sql += `
-- preguntas ${i + 1}-${i + part.length}
with src as (
  select * from jsonb_to_recordset($j$${J(part)}$j$::jsonb) as x(k text, c text, d int, kind text, p jsonb, a jsonb)
), ins as (
  insert into public.questions (legacy_key, category_id, difficulty, kind, prompt)
  select k, c, d, kind, p from src
  on conflict (legacy_key) do nothing
  returning id, legacy_key
)
insert into public.answers (question_id, position, is_correct, text)
select q.id, (a.value->>'pos')::int, (a.value->>'ok')::boolean, a.value->'t'
from src s
join ins q on q.legacy_key = s.k
cross join lateral jsonb_array_elements(s.a) as a(value)
on conflict (question_id, position) do nothing;
`;
  }
  if (process.argv.includes("--check")) {
    const cur = fs.existsSync(out) ? fs.readFileSync(out, "utf8").replace(/\r\n/g, "\n") : "";
    if (cur !== sql) { console.error("La migración 006 no coincide con la app: ejecuta node tools/export-content.js"); process.exit(1); }
    console.log("migración 006 al día (" + qrows.length + " preguntas)"); return;
  }
  fs.writeFileSync(out, sql, "utf8");
  console.log("escrita " + path.relative(root, out) + " · " + (sql.length / 1024).toFixed(0) + " KB · " + qrows.length + " preguntas");
})().catch(e => { console.error(e); process.exit(1); });
