// Auditoría de las migraciones en PostgreSQL real embebido (PGlite):
//  A) desde cero y ejecutando TODAS dos veces (idempotencia)
//  B) sobre una estructura equivalente a producción (migraciones 01 y 02 + datos de usuarios) y luego 03-08,
//     comprobando que no se pierde ni cambia ningún dato y que repetir la 04 con eventos no falsea nada
//  C) auditoría del catálogo: RLS, search_path de las funciones SECURITY DEFINER, privilegios de anon/authenticated,
//     vistas con security_invoker y claves ajenas a auth.users con borrado en cascada
// Simula Supabase con roles, auth.uid(), auth.jwt() y los privilegios por defecto que Supabase concede.
// NO prueba GoTrue, correo ni la red.
const { PGlite } = require("@electric-sql/pglite");
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "supabase", "migrations");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
const sqlOf = f => fs.readFileSync(path.join(dir, f), "utf8");
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };

async function supabaseLike() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, factor_type text not null, status text not null);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated, service_role;
    -- privilegios por defecto de Supabase: todo para anon, authenticated y service_role en lo que crea postgres
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;`);
  return db;
}
const as = async (db, role, uid, sql, params, aal = "aal1") => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ""}', false); select set_config('request.jwt.claims', '{"sub":"${uid || ""}","aal":"${aal}"}', false); set role ${role};`);
  try { return { r: await db.query(sql, params) }; } catch (e) { return { e: e.message || String(e) }; } finally { await db.exec("reset role;"); }
};
const U = i => "00000000-0000-4000-8000-" + String(i).padStart(12, "0");

(async () => {
  // ================= A) desde cero + doble ejecución =================
  const a = await supabaseLike();
  let err = null;
  try { for (const f of files) await a.exec(sqlOf(f)); } catch (e) { err = e; }
  ok(!err, "las 8 migraciones se aplican desde cero sin error: " + (err && err.message));
  const shape = async db => JSON.stringify([
    (await db.query("select count(*)::int c from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v')")).rows[0].c,
    (await db.query("select count(*)::int c from pg_policies where schemaname='public'")).rows[0].c,
    (await db.query("select count(*)::int c from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'")).rows[0].c,
    (await db.query("select count(*)::int c from pg_indexes where schemaname='public'")).rows[0].c,
    (await db.query("select count(*)::int c from public.questions")).rows[0].c,
    (await db.query("select count(*)::int c from public.answers")).rows[0].c,
    (await db.query("select count(*)::int c from public.lessons")).rows[0].c]);
  const s1 = await shape(a);
  err = null;
  try { for (const f of files) await a.exec(sqlOf(f)); } catch (e) { err = e; }
  ok(!err, "ejecutar TODAS las migraciones por segunda vez no da error (idempotencia): " + (err && err.message));
  ok(s1 === await shape(a), "tras la segunda ejecución nada se duplica ni cambia (tablas, políticas, funciones, índices, contenido)");

  // ================= B) estructura equivalente a producción =================
  const b = await supabaseLike();
  await b.exec(sqlOf(files[0]));                                           // 01 progress (ya aplicada en producción)
  for (let i = 1; i <= 4; i++) await b.exec(`insert into auth.users values ('${U(i)}')`);
  for (let i = 1; i <= 4; i++) await b.query("insert into public.progress (user_id, data) values ($1, $2)", [U(i), JSON.stringify({ v: 2, xp: i * 1000, name: "J" + i, hist: Array.from({ length: 50 }, (_, k) => "q" + k), done: { "g:1": i } })]);
  await b.exec(sqlOf(files[1]));                                           // 02 profiles + stats + trigger + backfill
  await b.exec(`insert into public.stats (user_id, xp, streak, last_day, levels_done) values
    ('${U(1)}', 500, 3, current_date, 12), ('${U(2)}', 12000, 40, current_date - 1, 90), ('${U(3)}', 0, 0, null, 0)`);
  await b.exec(`update public.profiles set display_name = 'Ana' where id = '${U(1)}'`);
  const snap = async () => JSON.stringify([
    (await b.query("select user_id, data, updated_at from public.progress order by user_id")).rows,
    (await b.query("select id, display_name from public.profiles order by id")).rows,
    (await b.query("select user_id, xp, streak, last_day, levels_done from public.stats order by user_id")).rows]);
  const before = await snap();
  ok((await b.query("select count(*)::int c from public.profiles")).rows[0].c === 4, "producción simulada: 4 usuarios con perfil, 4 progresos, 3 estadísticas");
  err = null;
  try { for (const f of files.slice(2)) await b.exec(sqlOf(f)); } catch (e) { err = e; }
  ok(!err, "03-08 se aplican sobre la estructura de producción sin error: " + (err && err.message));
  ok(before === await snap(), "NINGÚN dato de progress, profiles ni stats cambia al aplicar 03-08");
  const st = (await b.query("select user_id, xp, base_xp, legacy_imported from public.stats order by user_id")).rows;
  ok(st.length === 3 && st.every(r => r.base_xp === r.xp && r.legacy_imported === true), "el XP existente pasa a base_xp y se marca como importado");
  // la app antigua sigue pudiendo leer y escribir progreso y perfil
  let q = await as(b, "authenticated", U(1), "select count(*)::int c from public.progress");
  ok(q.r && q.r.rows[0].c === 1, "un usuario existente sigue viendo su progreso");
  q = await as(b, "authenticated", U(1), "update public.progress set data = '{\"v\":2,\"xp\":1}' where user_id = $1 returning 1", [U(1)]);
  ok(q.r && q.r.rows.length === 1, "y puede seguir guardándolo");
  q = await as(b, "authenticated", U(1), "update public.profiles set display_name = 'Ana B' where id = $1 returning 1", [U(1)]);
  ok(q.r && q.r.rows.length === 1, "y puede seguir editando su perfil");
  q = await as(b, "authenticated", U(1), "update public.stats set xp = 99999 where user_id = $1", [U(1)]);
  ok(q.e, "pero ya no puede tocar sus estadísticas directamente");
  // con eventos, repetir la 004 NO falsea base_xp ni legacy_imported
  q = await as(b, "authenticated", U(1), "select public.award_xp($1,'level','lv:g:0:1',10,current_date) r", [U(101)]);
  ok(q.r && q.r.rows[0].r.xp === 510, "un usuario existente cobra XP encima de su base (500 → 510)");
  const sx = async () => JSON.stringify((await b.query("select user_id, xp, base_xp, legacy_imported, streak from public.stats order by user_id")).rows);
  // cuenta NUEVA (creada después de la 04) que cobra XP: su fila nace con legacy_imported=false y base_xp=0
  await b.exec(`insert into auth.users values ('${U(5)}')`);
  q = await as(b, "authenticated", U(5), "select public.award_xp($1,'level','lv:g:0:1',10,current_date) r", [U(105)]);
  const nuevo = async () => JSON.stringify((await b.query(`select xp, base_xp, legacy_imported from public.stats where user_id='${U(5)}'`)).rows);
  ok((await nuevo()) === JSON.stringify([{ xp: 10, base_xp: 0, legacy_imported: false }]), "una cuenta nueva cobra XP con base_xp=0: " + (await nuevo()));
  const mid = await sx();
  await b.exec(sqlOf(files[3]));
  ok(mid === await sx(), "repetir la migración 04 con eventos ya registrados no modifica xp, base_xp ni legacy_imported");
  ok((await nuevo()) === JSON.stringify([{ xp: 10, base_xp: 0, legacy_imported: false }]), "repetir la 04 NO convierte en «base» el XP ganado por una cuenta nueva: " + (await nuevo()));
  for (const f of files.slice(2)) await b.exec(sqlOf(f));
  ok(mid === await sx() && before.length > 0, "repetir 03-08 completas tampoco cambia nada");

  // ================= C) auditoría del catálogo (sobre la base de producción simulada) =================
  const rows = async sql => (await b.query(sql)).rows;
  const noRls = await rows("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity");
  ok(noRls.length === 0, "todas las tablas públicas tienen RLS: sin RLS = " + JSON.stringify(noRls));

  const def = await rows("select p.proname, p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef");
  ok(def.length >= 6, "hay funciones SECURITY DEFINER para auditar: " + def.map(d => d.proname).join(", "));
  const badPath = def.filter(d => d.proname !== "handle_new_user" && !(d.proconfig || []).some(c => /^search_path=("")?$/.test(c)));
  ok(badPath.length === 0, "toda función SECURITY DEFINER fija search_path vacío: " + JSON.stringify(badPath));
  const hn = def.find(d => d.proname === "handle_new_user");
  ok(hn && (hn.proconfig || []).some(c => /^search_path=("")?$/.test(c)), "handle_new_user también fija search_path");

  const exec = await rows(`select p.proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname <> 'handle_new_user'`);
  ok(exec.length >= 5 && exec.every(r => r.anon === false), "ninguna función pública es ejecutable por anon: " + JSON.stringify(exec.filter(r => r.anon).map(r => r.proname)));
  ok(exec.every(r => r.auth === true), "todas son ejecutables por authenticated (las llama la app con sesión)");

  const tabs = await rows("select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v') order by 1");
  const priv = async (role, rel) => (await rows(`select ${["select", "insert", "update", "delete", "truncate", "references", "trigger"].map(p => `has_table_privilege('${role}', 'public.${rel}', '${p}') as ${p}`).join(", ")}`))[0];
  const writeAllowed = { progress: ["select", "insert", "update", "delete"], profiles: ["select", "insert", "update"] };
  const publicRead = new Set(["courses", "categories", "lessons", "exercises", "questions", "answers"]);
  const bad = [];
  for (const t of tabs) {
    const pa = await priv("anon", t.relname), pu = await priv("authenticated", t.relname);
    const allowedAuth = new Set(writeAllowed[t.relname] || ["select"]);
    for (const k of Object.keys(pa)) {
      if (pa[k] && !(k === "select" && publicRead.has(t.relname))) bad.push(`anon ${k} ${t.relname}`);
      if (pu[k] && !allowedAuth.has(k)) bad.push(`authenticated ${k} ${t.relname}`);
    }
  }
  ok(bad.length === 0, "privilegios mínimos en todas las tablas y vistas: " + JSON.stringify(bad));

  const pol = await rows("select tablename, policyname, cmd, roles, permissive from pg_policies where schemaname='public'");
  const openPol = pol.filter(p => p.cmd !== "SELECT" && (p.roles.includes("anon") || p.roles.includes("public")));
  ok(openPol.length === 0, "ninguna política de escritura para anon/public: " + JSON.stringify(openPol));
  const anonSel = pol.filter(p => (p.roles.includes("anon") || p.roles.includes("public")) && !publicRead.has(p.tablename));
  ok(anonSel.length === 0, "anon solo lee las tablas de contenido público: " + JSON.stringify(anonSel));
  const userTables = ["progress", "profiles", "stats", "xp_events", "question_history"];
  const noAal = userTables.filter(t => !pol.some(p => p.tablename === t && p.permissive === "RESTRICTIVE"));
  ok(noAal.length === 0, "todas las tablas privadas tienen la política restrictiva de AAL2: " + JSON.stringify(noAal));

  const v = await rows("select c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'");
  ok(v.length >= 1 && v.every(x => (x.reloptions || []).includes("security_invoker=true")), "las vistas usan security_invoker: " + JSON.stringify(v));

  const fk = await rows(`select conrelid::regclass::text t, confdeltype from pg_constraint where contype='f' and confrelid='auth.users'::regclass`);
  ok(fk.length >= 5 && fk.every(f => f.confdeltype === "c"), "todas las claves ajenas a auth.users borran en cascada: " + JSON.stringify(fk));

  // los datos privados no son accesibles sin sesión ni por otro usuario
  for (const t of ["progress", "profiles", "stats", "xp_events", "question_history"]) {
    q = await as(b, "anon", "", `select count(*)::int c from public.${t}`);
    ok(q.e || q.r.rows[0].c === 0, `anon no ve ${t}`);
    q = await as(b, "authenticated", U(2), `select count(*)::int c from public.${t} where ${t === "profiles" ? "id" : "user_id"} <> '${U(2)}'`);
    ok(q.r && q.r.rows[0].c === 0, `un usuario no ve filas ajenas de ${t}`);
  }

  console.log(`migrations.test: ${n - fails}/${n} comprobaciones correctas`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
