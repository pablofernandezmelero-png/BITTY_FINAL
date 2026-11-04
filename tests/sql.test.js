// Prueba las migraciones SQL en un PostgreSQL real embebido (PGlite).
// Simula Supabase con: esquema auth, auth.uid() y los roles anon/authenticated.
// Comprueba RLS, permisos y la función award_xp. NO prueba GoTrue ni la red.
const { PGlite } = require("@electric-sql/pglite");
const fs = require("fs"), path = require("path");
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };

const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222", OLD = "33333333-3333-3333-3333-333333333333";
const uuid = i => "aaaaaaaa-0000-0000-0000-" + String(i).padStart(12, "0");

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, factor_type text not null, status text not null);
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  // Estado "anterior": migraciones 1 y 2 y un usuario antiguo con XP ya guardado.
  const dir = path.join(__dirname, "..", "supabase", "migrations");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  for (const f of files.slice(0, 2)) await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  await db.exec(`insert into auth.users values ('${OLD}'); insert into public.stats (user_id, xp, streak, levels_done) values ('${OLD}', 777, 3, 12);`);
  for (const f of files.slice(2)) await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  console.log("Migraciones aplicadas: " + files.length);

  const as = async (role, uid, sql, params, aal = "aal1") => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ""}', false); select set_config('request.jwt.claims', '{"sub":"${uid || ""}","aal":"${aal}"}', false); set role ${role};`);
    try { return { r: await db.query(sql, params) }; }
    catch (e) { return { e: e.message || String(e) }; }
    finally { await db.exec("reset role;"); }
  };
  const award = (uid, id, kind, ref, xp, day) => as("authenticated", uid, "select public.award_xp($1,$2,$3,$4,$5) as r", [id, kind, ref, xp, day]);
  const today = (await db.query("select (now() at time zone 'utc')::date::text d")).rows[0].d;
  const dayOf = k => new Date(Date.parse(today) + k * 864e5).toISOString().slice(0, 10);
  const slow = async () => db.exec("update public.xp_events set created_at = created_at - interval '1 minute';");
  const xpOf = async uid => (await db.query("select xp, streak, levels_done, base_xp from public.stats where user_id=$1", [uid])).rows[0];

  // 1. Compatibilidad: el XP anterior se conserva
  let s = await xpOf(OLD);
  ok(s.xp === 777 && s.base_xp === 777 && s.streak === 3 && s.levels_done === 12, "el progreso anterior se conserva en base_xp");

  // 2. El cliente no puede escribir en stats ni en xp_events
  let q = await as("authenticated", A, "insert into public.stats (user_id, xp) values ($1, 99999999)", [A]);
  ok(q.e, "insertar en stats debe estar prohibido");
  q = await as("authenticated", OLD, "update public.stats set xp = 100000000 where user_id = $1", [OLD]);
  ok(q.e, "actualizar stats debe estar prohibido");
  q = await as("authenticated", A, "insert into public.xp_events (id,user_id,kind,ref,xp,day) values ($1,$2,'level','x',10,current_date)", [uuid(900), A]);
  ok(q.e, "insertar en xp_events debe estar prohibido");
  ok((await xpOf(OLD)).xp === 777, "el XP antiguo no cambió");

  // 3. anon no puede llamar a las funciones
  q = await as("anon", "", "select public.award_xp($1,'level','lv:g:0',10,$2) ", [uuid(1), today]);
  ok(q.e, "anon no puede llamar a award_xp");
  q = await as("authenticated", "", "select public.award_xp($1,'level','lv:g:0',10,$2) ", [uuid(1), today]);
  ok(q.e && /not_authenticated/.test(q.e), "sin sesión (uid nulo) se rechaza");

  // 4. Caso normal e idempotencia
  q = await award(A, uuid(1), "level", "lv:g:1:0", 10, today);
  ok(q.r && q.r.rows[0].r.awarded === 10 && q.r.rows[0].r.xp === 10 && q.r.rows[0].r.streak === 1, "primer nivel concede 10 XP y racha 1");
  q = await award(A, uuid(1), "level", "lv:g:1:0", 10, today);
  ok(q.r && q.r.rows[0].r.awarded === 0 && q.r.rows[0].r.xp === 10, "reintentar el mismo evento no duplica");
  await slow();
  q = await award(A, uuid(2), "level", "lv:g:1:0", 10, today);
  ok(q.r && q.r.rows[0].r.awarded === 0 && q.r.rows[0].r.xp === 10, "la misma recompensa de primera vez no se cobra dos veces (otro id)");

  // 5. Validación de recompensas
  await slow();
  for (const [k, ref, xp] of [["level", "lv:a", 11], ["level", "lv:a", 9999], ["boss", "lv:b", 10], ["challenge", "ch:d:1", 51], ["replay", "r", 6], ["otro", "r", 5]]) {
    q = await award(A, uuid(100 + xp), k, ref, xp, today);
    ok(q.e, `recompensa inválida rechazada: ${k} ${xp}`);
  }
  q = await award(A, uuid(300), "level", "NO VALIDO!", 10, today);
  ok(q.e && /invalid_ref/.test(q.e), "referencia con caracteres inválidos rechazada");
  q = await award(A, uuid(301), "level", "lv:z", 10, dayOf(5));
  ok(q.e && /invalid_day/.test(q.e), "fecha lejana rechazada");
  ok((await xpOf(A)).xp === 10, "nada de lo inválido sumó XP");

  // 6. Límite de ritmo
  await slow();
  q = await award(A, uuid(3), "boss", "lv:g:1:5", 40, today);
  ok(q.r && q.r.rows[0].r.xp === 50, "jefe suma 40");
  q = await award(A, uuid(4), "special", "sp:1:1", 50, today);
  ok(q.e && /rate_limited/.test(q.e), "dos eventos seguidos: límite de ritmo");
  ok((await xpOf(A)).xp === 50, "el evento limitado no sumó");

  // 7. Aislamiento entre usuarios
  q = await as("authenticated", B, "select * from public.stats");
  ok(q.r && q.r.rows.length === 0, "B no ve las estadísticas de A");
  q = await as("authenticated", B, "select * from public.xp_events");
  ok(q.r && q.r.rows.length === 0, "B no ve los eventos de A");
  q = await award(B, uuid(3), "boss", "lv:g:1:5", 40, today);
  ok(q.e && /invalid_event/.test(q.e), "B no puede reutilizar el id de evento de A");
  q = await award(B, uuid(50), "boss", "lv:g:1:5", 40, today);
  ok(q.r && q.r.rows[0].r.awarded === 40, "B sí cobra su propia recompensa con la misma referencia");
  ok((await xpOf(A)).xp === 50 && (await xpOf(B)).xp === 40, "XP independiente por usuario");

  // 8. Racha
  await slow();
  q = await award(A, uuid(5), "level", "lv:g:1:1", 10, dayOf(1));
  ok(q.r && q.r.rows[0].r.streak === 2, "día siguiente: racha 2");
  await slow();
  q = await award(A, uuid(6), "level", "lv:g:1:2", 10, dayOf(1));
  ok(q.r && q.r.rows[0].r.streak === 2, "mismo día: racha igual");
  await slow();
  q = await award(A, uuid(7), "level", "lv:g:1:3", 10, today);
  ok(q.r && q.r.rows[0].r.streak === 2, "día anterior no resta ni reinicia");

  // 9. Tope diario
  await db.exec(`insert into public.xp_events (id,user_id,kind,ref,xp,day,created_at)
    select ('bbbbbbbb-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid, '${B}', 'replay', 'fill' || i, 5, current_date, now() - interval '1 hour'
    from generate_series(1, 595) i;`);
  q = await award(B, uuid(60), "replay", "replay:x", 5, today);
  ok(q.e && /daily_cap/.test(q.e), "se alcanza el tope diario de 3000 XP");

  // 10. Importación del progreso local: una vez, con tope
  q = await as("authenticated", OLD, "select public.import_legacy_stats(5000, 4, current_date, 20) r");
  ok(q.r && q.r.rows[0].r.imported === false && (await xpOf(OLD)).xp === 777, "cuenta antigua no puede reimportar");
  const C = "44444444-4444-4444-4444-444444444444";
  await db.exec(`insert into auth.users values ('${C}')`);
  q = await as("authenticated", C, "select public.import_legacy_stats(99999999, 4, current_date, 20) r");
  ok(q.r && q.r.rows[0].r.imported === true && (await xpOf(C)).xp === 20000, "importación limitada al tope (20000)");
  q = await as("authenticated", C, "select public.import_legacy_stats(1, 1, current_date, 1) r");
  ok(q.r && q.r.rows[0].r.imported === false && (await xpOf(C)).xp === 20000, "segunda importación ignorada");

  // 10a. Bonus de anuncio recompensado: 10 XP, 3 al día, una vez por referencia
  await slow();
  q = await award(C, uuid(800), "ad", "ad:" + today + ":1", 10, today);
  ok(q.r && q.r.rows[0].r.awarded === 10, "bonus de anuncio 1/3 concede 10 XP");
  await slow();
  q = await award(C, uuid(801), "ad", "ad:" + today + ":1", 10, today);
  ok(q.r && q.r.rows[0].r.awarded === 0, "el mismo bonus no se cobra dos veces");
  await slow();
  q = await award(C, uuid(802), "ad", "ad:" + today + ":4", 10, today);
  ok(q.e && /invalid_reward/.test(q.e), "no existe un 4.º bonus al día");
  await slow();
  q = await award(C, uuid(803), "ad", "ad:" + dayOf(-1) + ":2", 10, today);
  ok(q.e && /invalid_reward/.test(q.e), "la referencia del bonus debe ser la del día indicado");
  await slow();
  q = await award(C, uuid(804), "ad", "ad:" + today + ":2", 20, today);
  ok(q.e && /invalid_reward/.test(q.e), "el bonus no puede valer más de 10");

  // 10b. 2FA: con factor TOTP verificado, solo AAL2 accede
  const M = "55555555-5555-5555-5555-555555555555";
  await db.exec(`insert into auth.users values ('${M}'); insert into auth.mfa_factors (user_id, factor_type, status) values ('${M}', 'totp', 'verified');`);
  q = await as("authenticated", C, "select public.aal_ok() r");
  ok(q.r && q.r.rows[0].r === true, "sin factor, AAL1 basta");
  q = await as("authenticated", M, "select public.aal_ok() r");
  ok(q.r && q.r.rows[0].r === false, "con factor verificado, AAL1 no basta");
  q = await as("authenticated", M, "select public.aal_ok() r", [], "aal2");
  ok(q.r && q.r.rows[0].r === true, "con factor verificado, AAL2 sí");
  q = await as("authenticated", M, "select * from public.profiles where id=$1", [M]);
  ok(q.r && q.r.rows.length === 0, "AAL1 con 2FA activo no lee su perfil");
  q = await as("authenticated", M, "select * from public.profiles where id=$1", [M], "aal2");
  ok(q.r && q.r.rows.length === 1, "AAL2 sí lee su perfil");
  q = await as("authenticated", M, "insert into public.progress (user_id, data) values ($1, '{}')", [M]);
  ok(q.e, "AAL1 con 2FA activo no escribe progreso");
  q = await as("authenticated", M, "insert into public.progress (user_id, data) values ($1, '{}')", [M], "aal2");
  ok(q.r, "AAL2 sí escribe progreso");
  q = await as("authenticated", M, "select public.award_xp($1,'level','lv:m:1',10,$2)", [uuid(700), today]);
  ok(q.e && /mfa_required/.test(q.e), "AAL1 con 2FA activo no puede cobrar XP");
  q = await as("authenticated", M, "select public.award_xp($1,'level','lv:m:1',10,$2) r", [uuid(701), today], "aal2");
  ok(q.r && q.r.rows[0].r.awarded === 10, "AAL2 sí cobra XP");
  q = await as("authenticated", M, "select public.import_legacy_stats(5,1,null,1)");
  ok(q.e && /mfa_required/.test(q.e), "AAL1 con 2FA activo no puede importar");
  q = await as("authenticated", M, "select count(*)::int c from public.xp_events");
  ok(q.r && q.r.rows[0].c === 0, "AAL1 con 2FA no ve eventos");
  q = await as("authenticated", B, "select public.aal_ok() r");
  ok(q.r && q.r.rows[0].r === true, "otro usuario sin factor no se ve afectado");
  await db.exec("update auth.mfa_factors set status='unverified'");
  q = await as("authenticated", M, "select public.aal_ok() r");
  ok(q.r && q.r.rows[0].r === true, "factor sin verificar (inscripción a medias) no bloquea");

  // 11. RLS de progress, profiles y borrado en cascada
  await as("authenticated", A, "insert into public.progress (user_id, data) values ($1, '{\"xp\":1}')", [A]);
  q = await as("authenticated", B, "select * from public.progress");
  ok(q.r && q.r.rows.length === 0, "B no ve el progreso de A");
  q = await as("authenticated", B, "update public.progress set data='{\"hack\":1}' where user_id=$1 returning 1", [A]);
  ok(q.r && q.r.rows.length === 0, "B no puede modificar el progreso de A");
  q = await as("authenticated", B, "insert into public.progress (user_id, data) values ($1, '{}')", [A]);
  ok(q.e, "B no puede insertar progreso a nombre de A");
  q = await as("anon", "", "select * from public.progress");
  ok(q.e || q.r.rows.length === 0, "anon no ve progreso");
  q = await as("authenticated", B, "update public.profiles set display_name='x' where id=$1 returning 1", [A]);
  ok(q.r && q.r.rows.length === 0, "B no puede modificar el perfil de A");
  await db.exec(`delete from auth.users where id='${A}'`);
  ok((await db.query(`select count(*)::int c from public.xp_events where user_id='${A}'`)).rows[0].c === 0 &&
     (await db.query(`select count(*)::int c from public.stats where user_id='${A}'`)).rows[0].c === 0, "borrar la cuenta borra sus datos en cascada");

  console.log(`sql.test: ${n - fails}/${n} comprobaciones correctas`);
  if (fails) { console.log(fails + " FALLOS"); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
