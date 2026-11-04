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
  q = await award(B, uuid(60), "replay", "re:" + uuid(777), 5, today);
  ok(q.e && /daily_cap|replay_cap/.test(q.e), "se alcanza un tope (3000 XP/24 h o repeticiones): " + q.e);

  // 10. Importación del progreso local: una vez, con tope
  q = await as("authenticated", OLD, "select public.import_legacy_stats(5000, 4, current_date, 20) r");
  ok(q.r && q.r.rows[0].r.imported === false && (await xpOf(OLD)).xp === 777, "cuenta antigua no puede reimportar");
  const C = "44444444-4444-4444-4444-444444444444";
  await db.exec(`insert into auth.users values ('${C}')`);
  q = await as("authenticated", C, "select public.import_legacy_stats(99999999, 4, current_date, 20) r");
  ok(q.r && q.r.rows[0].r.imported === true && (await xpOf(C)).xp === 20000, "importación limitada al tope (20000)");
  q = await as("authenticated", C, "select public.import_legacy_stats(1, 1, current_date, 1) r");
  ok(q.r && q.r.rows[0].r.imported === false && (await xpOf(C)).xp === 20000, "segunda importación ignorada");

  // 5b. Referencias inventadas, retos validados, topes con la hora del SERVIDOR
  const F = "88888888-8888-8888-8888-888888888888", G = "99999999-9999-9999-9999-999999999999", H = "abababab-abab-abab-abab-abababababab", E = "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd";
  await db.exec(`insert into auth.users values ('${F}'), ('${G}'), ('${H}'), ('${E}')`);
  for (const [k, ref, xp, why] of [["level", "lv:g:1:100", 10, "posición de 3 cifras"], ["level", "lv:g:3:1", 10, "dificultad 3"], ["level", "lv:x:0:1", 10, "ruta inexistente"],
    ["level", "cualquier-cosa", 10, "referencia libre"], ["special", "sp:100:1", 50, "especial de 3 cifras"], ["replay", "re:no-es-uuid", 5, "replay sin uuid"], ["replay", "lv:g:0:1", 5, "replay con ref de nivel"]]) {
    await slow(); q = await award(E, uuid(1000 + Math.floor(Math.random() * 1e6)), k, ref, xp, today);
    ok(q.e && /invalid_ref/.test(q.e), `referencia inventada rechazada (${why}): ${q.e}`);
  }
  const cE = [["d", today, 1, 80, true, "reto diario correcto"], ["d", today, 1, 50, false, "reto diario con XP de otra dificultad"], ["d", dayOf(-5), 0, 50, false, "reto diario de otra fecha"],
    ["w", dayOf(-3), 2, 480, true, "reto semanal correcto"], ["w", dayOf(-30), 0, 180, false, "reto semanal antiguo"], ["w", today, 0, 480, false, "reto semanal con XP de otra dificultad"], ["d", "2026-02-31", 0, 50, false, "fecha imposible"]];
  for (const [t, d, dif, xp, good, why] of cE) {
    await slow(); q = await award(E, uuid(2000 + Math.floor(Math.random() * 1e6)), "challenge", `ch:${t}:${d}:${dif}`, xp, today);
    ok(good ? q.r && q.r.rows[0].r.awarded === xp : q.e, `${why}: ${good ? "se concede" : "se rechaza"}`);
  }
  // tope de 24 h con hora del servidor: 2.990 XP con campo «día» repartido entre ayer, hoy y mañana
  await db.exec(`insert into public.xp_events (id,user_id,kind,ref,xp,day,created_at)
    select gen_random_uuid(), '${F}', 'special', 'x' || i, case when i <= 5 then 500 else 10 end, current_date + ((i % 3) - 1), now() - interval '1 hour'
    from generate_series(1, 54) i;`);
  const sumF = (await db.query(`select sum(xp)::int s from public.xp_events where user_id='${F}'`)).rows[0].s;
  q = await award(F, uuid(3001), "level", "lv:g:0:7", 10, today);
  ok(sumF === 2990 && q.r && q.r.rows[0].r.awarded === 10, "hasta 3000 XP en 24 h se concede (llevaba " + sumF + ")");
  await slow();
  q = await award(F, uuid(3002), "level", "lv:g:0:8", 10, dayOf(1));
  ok(q.e && /daily_cap/.test(q.e), "cambiar el campo «día» NO evita el tope de 24 h: " + q.e);
  // repeticiones: 500 XP por 24 h
  await db.exec(`insert into public.xp_events (id,user_id,kind,ref,xp,day,created_at)
    select gen_random_uuid(), '${G}', 'replay', 're:' || gen_random_uuid(), 5, current_date, now() - interval '1 hour' from generate_series(1, 99) i;`);
  q = await award(G, uuid(3101), "replay", "re:" + uuid(3101), 5, today);
  ok(q.r && q.r.rows[0].r.awarded === 5, "la repetición 100 (500 XP) se concede");
  await slow();
  q = await award(G, uuid(3102), "replay", "re:" + uuid(3102), 5, today);
  ok(q.e && /replay_cap/.test(q.e), "la repetición 101 se rechaza (tope 500 XP/24 h): " + q.e);
  q = await award(G, uuid(3103), "level", "lv:g:0:9", 10, today);
  ok(q.r && q.r.rows[0].r.awarded === 10, "el tope de repeticiones no bloquea los niveles de primera vez");
  // anuncios: 3 por 24 h aunque se cambie el día
  await db.exec(`insert into public.xp_events (id,user_id,kind,ref,xp,day,created_at)
    select gen_random_uuid(), '${H}', 'ad', 'ad:' || (current_date - 1)::text || ':' || i, 10, current_date - 1, now() - interval '2 hours' from generate_series(1, 3) i;`);
  q = await award(H, uuid(3201), "ad", "ad:" + today + ":1", 10, today);
  ok(q.e && /ad_cap/.test(q.e), "el 4.º anuncio en 24 h se rechaza aunque cambie el día: " + q.e);

  // 10a-bis. importar progreso con eventos ya registrados (cuenta nueva que ya jugó): se rechaza y no cambia el XP
  const xpA0 = (await xpOf(A)).xp;
  q = await as("authenticated", A, "select public.import_legacy_stats(20000, 99, current_date, 500) r");
  ok(q.r && q.r.rows[0].r.imported === false && (await xpOf(A)).xp === xpA0, "una cuenta con eventos de XP no puede importar progreso (xp " + xpA0 + " intacto)");
  // 10a. Bonus de anuncio recompensado: 10 XP, 3 al día, una vez por referencia
  await slow();
  q = await award(C, uuid(800), "ad", "ad:" + today + ":1", 10, today);
  ok(q.r && q.r.rows[0].r.awarded === 10, "bonus de anuncio 1/3 concede 10 XP");
  await slow();
  q = await award(C, uuid(801), "ad", "ad:" + today + ":1", 10, today);
  ok(q.r && q.r.rows[0].r.awarded === 0, "el mismo bonus no se cobra dos veces");
  await slow();
  q = await award(C, uuid(802), "ad", "ad:" + today + ":4", 10, today);
  ok(q.e && /invalid_ref/.test(q.e), "no existe un 4.º bonus al día");
  await slow();
  q = await award(C, uuid(803), "ad", "ad:" + dayOf(-1) + ":2", 10, today);
  ok(q.e && /invalid_ref/.test(q.e), "la referencia del bonus debe ser la del día indicado");
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
  q = await as("authenticated", M, "select public.award_xp($1,'level','lv:g:0:1',10,$2)", [uuid(700), today]);
  ok(q.e && /mfa_required/.test(q.e), "AAL1 con 2FA activo no puede cobrar XP");
  q = await as("authenticated", M, "select public.award_xp($1,'level','lv:g:0:1',10,$2) r", [uuid(701), today], "aal2");
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

  // 10c. activity_log (vista sobre xp_events) y question_history
  q = await as("authenticated", B, "select count(*)::int c from public.activity_log");
  ok(q.r && q.r.rows[0].c > 500, "B ve su propia actividad en activity_log");
  q = await as("authenticated", C, "select count(*)::int c from public.activity_log");
  ok(q.r && q.r.rows[0].c === 1, "C solo ve la suya (1 evento de anuncio), no la de B: " + (q.r && q.r.rows[0].c));
  q = await as("authenticated", B, "insert into public.activity_log (id,user_id,kind,ref,xp,day) values (gen_random_uuid(),$1,'level','x',10,current_date)", [B]);
  ok(q.e, "activity_log es de solo lectura");
  q = await as("anon", "", "select * from public.activity_log");
  ok(q.e, "anon no puede leer activity_log");
  q = await as("authenticated", M, "select count(*)::int c from public.activity_log");
  await db.exec("update auth.mfa_factors set status='verified'");
  q = await as("authenticated", M, "select count(*)::int c from public.activity_log");
  ok(q.r && q.r.rows[0].c === 0, "AAL1 con 2FA activo no ve su actividad");
  q = await as("authenticated", M, "select count(*)::int c from public.activity_log", [], "aal2");
  ok(q.r && q.r.rows[0].c >= 1, "AAL2 sí ve su actividad");

  q = await as("authenticated", B, "select public.add_question_history($1::jsonb) r", [JSON.stringify([{ k: "p1", t: "g", d: 1 }, { k: "p2", t: "g", d: 1 }, { k: "p1", t: "g", d: 1 }, { k: "p1", t: "py", d: 1 }])]);
  ok(q.r && q.r.rows[0].r === 3, "se guardan 3 entradas únicas (la repetida se ignora): " + (q.r && q.r.rows[0].r));
  q = await as("authenticated", B, "select public.add_question_history($1::jsonb) r", [JSON.stringify([{ k: "x", t: "zz", d: 1 }, { k: "x", t: "g", d: 9 }, { k: "", t: "g", d: 1 }])]);
  ok(q.r && q.r.rows[0].r === 0, "entradas inválidas (ruta, dificultad, clave vacía) se descartan");
  q = await as("authenticated", B, "select public.add_question_history($1::jsonb)", [JSON.stringify(Array.from({ length: 501 }, (_, i) => ({ k: "k" + i, t: "g", d: 0 })))]);
  ok(q.e && /invalid_args/.test(q.e), "más de 500 por llamada se rechaza");
  q = await as("authenticated", C, "select count(*)::int c from public.question_history");
  ok(q.r && q.r.rows[0].c === 0, "C no ve el historial de B");
  q = await as("authenticated", B, "insert into public.question_history (user_id,qkey,track,difficulty) values ($1,'z','g',0)", [B]);
  ok(q.e, "no se puede escribir en question_history directamente");
  q = await as("authenticated", B, "delete from public.question_history");
  ok(q.e, "no se puede borrar de question_history directamente");
  q = await as("anon", "", "select public.add_question_history('[]'::jsonb)");
  ok(q.e, "anon no puede llamar a add_question_history");
  q = await as("authenticated", M, "select public.add_question_history('[]'::jsonb)");
  ok(q.e && /mfa_required/.test(q.e), "AAL1 con 2FA activo no puede escribir el historial");
  // tope de 40.000: se descartan las más antiguas
  await db.exec(`insert into public.question_history (user_id,qkey,track,difficulty,seen_at)
    select '${C}', 'old' || i, 'g', 0, now() - interval '1 day' - (i || ' seconds')::interval from generate_series(1, 40000) i;`);
  q = await as("authenticated", C, "select public.add_question_history($1::jsonb) r", [JSON.stringify([{ k: "nuevaA", t: "g", d: 0 }, { k: "nuevaB", t: "g", d: 0 }])]);
  const tot = (await db.query(`select count(*)::int c from public.question_history where user_id='${C}'`)).rows[0].c;
  const nuevas = (await db.query(`select count(*)::int c from public.question_history where user_id='${C}' and qkey like 'nueva%'`)).rows[0].c;
  const viejaBorrada = (await db.query(`select count(*)::int c from public.question_history where user_id='${C}' and qkey='old40000'`)).rows[0].c;
  ok(tot === 40000 && nuevas === 2 && viejaBorrada === 0, `tope 40.000: total ${tot}, nuevas conservadas ${nuevas}, la más antigua descartada ${viejaBorrada === 0}`);

  // 10d. eliminar la propia cuenta
  const D1 = "66666666-6666-6666-6666-666666666666", D2 = "77777777-7777-7777-7777-777777777777";
  await db.exec(`insert into auth.users values ('${D1}'), ('${D2}')`);
  await as("authenticated", D1, "select public.award_xp($1,'level','lv:g:0:2',10,$2)", [uuid(900), today]);
  await as("authenticated", D1, "select public.add_question_history($1::jsonb)", [JSON.stringify([{ k: "a", t: "g", d: 0 }])]);
  await as("authenticated", D1, "insert into public.progress (user_id, data) values ($1, '{}')", [D1]);
  q = await as("anon", "", "select public.delete_my_account()");
  ok(q.e, "anon no puede eliminar cuentas");
  q = await as("authenticated", "", "select public.delete_my_account()");
  ok(q.e && /not_authenticated/.test(q.e), "sin sesión no se elimina nada");
  await db.exec(`insert into auth.mfa_factors (user_id, factor_type, status) values ('${D2}', 'totp', 'verified')`);
  q = await as("authenticated", D2, "select public.delete_my_account()");
  ok(q.e && /mfa_required/.test(q.e) && (await db.query(`select 1 from auth.users where id='${D2}'`)).rows.length === 1, "AAL1 con 2FA activo no puede eliminar la cuenta");
  q = await as("authenticated", D1, "select public.delete_my_account()");
  const left = async t => (await db.query(`select count(*)::int c from public.${t} where user_id='${D1}'`)).rows[0].c;
  ok(q.r && (await db.query(`select 1 from auth.users where id='${D1}'`)).rows.length === 0, "el usuario elimina su cuenta");
  ok((await left("xp_events")) === 0 && (await left("progress")) === 0 && (await left("question_history")) === 0 && (await db.query(`select 1 from public.stats where user_id='${D1}'`)).rows.length === 0,
    "se borran en cascada su XP, progreso, estadísticas e historial");
  ok((await db.query(`select 1 from auth.users where id='${D2}'`)).rows.length === 1 && (await db.query(`select 1 from auth.users where id='${B}'`)).rows.length === 1, "no se toca a ningún otro usuario");

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
