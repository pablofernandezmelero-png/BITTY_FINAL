// Base de datos de contenido: aplica las migraciones 005 y 006 en PostgreSQL real (PGlite) y comprueba
// integridad, idempotencia, coincidencia con la app y permisos (lectura pública, escritura prohibida).
const { PGlite } = require("@electric-sql/pglite");
const fs = require("fs"), path = require("path"), cp = require("child_process");
const root = path.join(__dirname, "..");
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };

(async () => {
  // 1) la migración de carga coincide con la app
  const chk = cp.spawnSync(process.execPath, [path.join(root, "tools", "export-content.js"), "--check"], { encoding: "utf8" });
  ok(chk.status === 0, "la migración 006 no está al día con la app (node tools/export-content.js)");

  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;`);
  const dir = path.join(root, "supabase", "migrations");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  const f5 = files.find(f => /_content_schema\.sql$/.test(f)), f6 = files.find(f => /_content_seed\.sql$/.test(f));
  ok(f5 && f6, "faltan las migraciones de contenido");
  // las tablas de usuario no hacen falta para el contenido; solo se aplica 005 y 006
  await db.exec(fs.readFileSync(path.join(dir, f5), "utf8"));
  await db.exec("reset role;");
  const t0 = Date.now();
  await db.exec(fs.readFileSync(path.join(dir, f6), "utf8"));
  const cnt = async (t, w = "") => (await db.query(`select count(*)::int c from public.${t} ${w}`)).rows[0].c;

  // 2) cuentas
  const nq = await cnt("questions");
  console.log(`seed aplicado en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  ok(await cnt("courses") === 4, "4 cursos");
  ok(await cnt("categories") === 19, "19 categorías (bancos)");
  ok(await cnt("lessons") === 95 + 45 + 37 + 35, "212 lecciones (niveles)");
  ok(await cnt("lessons", "where is_boss") === 15 + 8 + 7 + 7, "37 mini-boss");
  ok(await cnt("exercises") === 212, "un ejercicio por lección");
  ok(nq === 1144, "1144 preguntas (las del banco actual): " + nq);
  ok(await cnt("questions", "where kind='order'") === 11, "11 preguntas de ordenar");

  // 3) integridad
  const q1 = (await db.query(`select count(*)::int c from public.questions q where q.kind='choice' and (select count(*) from public.answers a where a.question_id=q.id)<>4`)).rows[0].c;
  ok(q1 === 0, "toda pregunta de elegir tiene exactamente 4 respuestas");
  const q2 = (await db.query(`select count(*)::int c from public.questions q where q.kind='choice' and (select count(*) from public.answers a where a.question_id=q.id and a.is_correct)<>1`)).rows[0].c;
  ok(q2 === 0, "toda pregunta de elegir tiene exactamente 1 respuesta correcta");
  const q3 = (await db.query(`select count(*)::int c from public.questions q where q.kind='order' and (select count(*) from public.answers a where a.question_id=q.id)<2`)).rows[0].c;
  ok(q3 === 0, "toda pregunta de ordenar tiene al menos 2 pasos");
  const q4 = (await db.query(`select count(*)::int c from public.answers where coalesce(text->>'es','')='' or coalesce(text->>'en','')='' or coalesce(text->>'nl','')=''`)).rows[0].c;
  ok(q4 === 0, "ninguna respuesta sin los 3 idiomas");
  const q5 = (await db.query(`select count(*)::int c from public.questions where coalesce(prompt->>'es','')='' or coalesce(prompt->>'en','')='' or coalesce(prompt->>'nl','')=''`)).rows[0].c;
  ok(q5 === 0, "ninguna pregunta sin los 3 idiomas");
  const q6 = (await db.query(`select count(*)::int c from (select question_id, text->>'es' t from public.answers where question_id in (select id from public.questions where kind='choice') group by 1,2 having count(*)>1) d`)).rows[0].c;
  ok(q6 === 0, "sin respuestas repetidas dentro de una pregunta (es)");
  const byDiff = (await db.query("select difficulty, count(*)::int c from public.questions group by 1 order by 1")).rows.map(r => r.c);
  ok(byDiff.length === 3 && byDiff.every(c => c > 100), "las 3 dificultades están representadas: " + byDiff.join("/"));
  const nulls = (await db.query(`select count(*)::int c from public.lessons where title->>'en' = title->>'es' and title->>'nl' = title->>'es'`)).rows[0].c;
  ok(nulls < 30, "los títulos de lecciones están traducidos (iguales en los 3 idiomas: " + nulls + ")");

  // 4) idempotencia: ejecutar el seed otra vez no cambia nada
  const before = [await cnt("questions"), await cnt("answers"), await cnt("lessons"), await cnt("exercises")];
  await db.exec(fs.readFileSync(path.join(dir, f6), "utf8"));
  const after = [await cnt("questions"), await cnt("answers"), await cnt("lessons"), await cnt("exercises")];
  ok(JSON.stringify(before) === JSON.stringify(after), "el seed es idempotente: " + before + " → " + after);

  // 5) permisos
  const as = async (role, sql) => { await db.exec(`reset role; set role ${role};`); try { return { r: await db.query(sql) }; } catch (e) { return { e: e.message }; } finally { await db.exec("reset role;"); } };
  for (const role of ["anon", "authenticated"]) {
    let q = await as(role, "select count(*)::int c from public.questions");
    ok(q.r && q.r.rows[0].c === 1144, `${role} puede leer las preguntas`);
    q = await as(role, "select count(*)::int c from public.answers");
    ok(q.r && q.r.rows[0].c > 4000, `${role} puede leer las respuestas`);
    for (const w of ["insert into public.questions (legacy_key,category_id,difficulty,kind,prompt) values ('x:1','cmp',0,'choice','{\"es\":\"a\",\"en\":\"a\",\"nl\":\"a\"}')",
      "update public.questions set difficulty=0", "delete from public.questions", "delete from public.answers", "update public.answers set is_correct=true",
      "insert into public.courses (id,position,name) values ('zz',9,'{\"es\":\"a\",\"en\":\"a\",\"nl\":\"a\"}')", "delete from public.lessons", "truncate public.questions"]) {
      q = await as(role, w);
      ok(q.e, `${role} no puede escribir: ${w.slice(0, 40)}`);
    }
  }
  ok(await cnt("questions") === 1144, "tras los intentos de escritura no cambió nada");
  // inactivas no se ven
  await db.exec("update public.questions set active=false where legacy_key='cmp:0'");
  let q = await as("anon", "select count(*)::int c from public.questions where legacy_key='cmp:0'");
  ok(q.r && q.r.rows[0].c === 0, "una pregunta desactivada deja de ser visible");
  q = await as("anon", "select count(*)::int c from public.answers a join public.questions qq on qq.id=a.question_id where qq.legacy_key='cmp:0'");
  ok(q.r && q.r.rows[0].c === 0, "sus respuestas tampoco");
  // claves ajenas
  await db.exec("reset role;");
  let e; try { await db.exec("insert into public.questions (legacy_key,category_id,difficulty,kind,prompt) values ('zz:1','no-existe',0,'choice','{\"es\":\"a\",\"en\":\"a\",\"nl\":\"a\"}')"); } catch (x) { e = x; }
  ok(e, "no se admite una pregunta con categoría inexistente");
  try { e = null; await db.exec("insert into public.questions (legacy_key,category_id,difficulty,kind,prompt) values ('zz:2','cmp',5,'choice','{\"es\":\"a\",\"en\":\"a\",\"nl\":\"a\"}')"); } catch (x) { e = x; }
  ok(e, "no se admite una dificultad fuera de 0..2");
  try { e = null; await db.exec("insert into public.questions (legacy_key,category_id,difficulty,kind,prompt) values ('zz:3','cmp',0,'choice','{\"es\":\"a\"}')"); } catch (x) { e = x; }
  ok(e, "no se admite una pregunta sin los 3 idiomas");

  console.log(`content.test: ${n - fails}/${n} comprobaciones correctas`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
