// Pruebas de mutación de las reglas de seguridad SQL: rompe UNA regla cada vez (en el archivo real, con copia de
// seguridad que se restaura siempre), ejecuta los tests SQL y comprueba que ALGUNO falla. Si una mutación
// sobrevive (todos los tests pasan), la regla no está protegida por ningún test.
//   node tools/mutation-sql.js
const fs = require("fs"), path = require("path"), cp = require("child_process");
const root = path.join(__dirname, "..");
const mig = f => path.join(root, "supabase", "migrations", f);
const MUT = [
  ["04_xp_seguro.sql", "el tope diario vuelve a medirse con la fecha que envía el cliente", "where user_id = uid and created_at > now() - interval '24 hours';", "where user_id = uid and day = p_day;"],
  ["04_xp_seguro.sql", "se admiten referencias de nivel inventadas", "if p_ref !~ '^lv:(g|py|js|java):[0-2]:[0-9]{1,2}$' then raise exception 'invalid_ref' using errcode = '22023'; end if;", "null;"],
  ["04_xp_seguro.sql", "el reto no comprueba que el XP corresponda a su dificultad", "if p_xp <> v_expected then raise exception 'invalid_reward' using errcode = '22023'; end if;", "null;"],
  ["04_xp_seguro.sql", "se quita el tope de anuncios", "if p_kind = 'ad' and v_ads >= 3 then", "if false then"],
  ["04_xp_seguro.sql", "se quita el tope de repeticiones", "if p_kind = 'replay' and v_rep_xp + p_xp > 500 then", "if false then"],
  ["04_xp_seguro.sql", "se quita el límite de ritmo de 8 s", "if v_last is not null and v_last > now() - interval '8 seconds' then", "if false then"],
  ["04_xp_seguro.sql", "se permite importar el progreso aunque ya haya eventos (se quitan las DOS capas de protección)", [["and not exists (select 1 from public.xp_events e where e.user_id = public.stats.user_id)\n  returning * into v_stats;", "returning * into v_stats;"], ["(v_stats.legacy_imported or exists (select 1 from public.xp_events where user_id = uid))", "(v_stats.legacy_imported)"]]],
  ["04_xp_seguro.sql", "el cliente recupera permisos de escritura sobre stats", "revoke all on public.stats from anon, authenticated;\ngrant select on public.stats to authenticated;", "grant all on public.stats to authenticated;"],
  ["04_xp_seguro.sql", "la migración 04 repetida falsea base_xp (se quita la guarda de eventos)", "where s.legacy_imported = false\n  and not exists (select 1 from public.xp_events e where e.user_id = s.user_id);", "where s.legacy_imported = false;"],
  ["04_xp_seguro.sql", "award_xp ya no exige AAL2", "if not public.aal_ok() then\n    raise exception 'mfa_required' using errcode = '28000';\n  end if;\n  if p_event_id is null", "if p_event_id is null"],
  ["04_xp_seguro.sql", "award_xp deja de fijar search_path", "returns jsonb\nlanguage plpgsql\nsecurity definer\nset search_path = ''", "returns jsonb\nlanguage plpgsql\nsecurity definer"],
  ["04_xp_seguro.sql", "anon puede ejecutar award_xp", "revoke all on function public.award_xp(uuid, text, text, integer, date) from public, anon;", "revoke all on function public.award_xp(uuid, text, text, integer, date) from public;"],
  ["03_exigir_2fa.sql", "la sesión AAL1 vuelve a poder leer progress con 2FA activo", "create policy \"progress_require_aal\" on public.progress as restrictive for all to authenticated\n  using (public.aal_ok()) with check (public.aal_ok());", "create policy \"progress_require_aal\" on public.progress as restrictive for all to authenticated\n  using (true) with check (true);"],
  ["03_exigir_2fa.sql", "anon conserva privilegios sobre progress", "revoke all on public.progress from anon;", "select 1;"],
  ["03_exigir_2fa.sql", "authenticated conserva TRUNCATE sobre profiles", "revoke delete, truncate, references, trigger on public.profiles from authenticated;", "select 1;"],
  ["07_actividad_e_historial.sql", "la vista activity_log filtra datos de otros usuarios (sin security_invoker)", "with (security_invoker = true)", ""],
  ["07_actividad_e_historial.sql", "se quita el tope de 40.000 del historial", "if v_total > 40000 then", "if false then"],
  ["07_actividad_e_historial.sql", "question_history deja de exigir AAL2", "create policy \"question_history_require_aal\" on public.question_history as restrictive for select to authenticated using (public.aal_ok());", "select 1;"],
  ["07_actividad_e_historial.sql", "el cliente puede escribir en question_history", "revoke all on public.question_history from anon, authenticated;\ngrant select on public.question_history to authenticated;", "grant all on public.question_history to authenticated;"],
  ["08_eliminar_cuenta.sql", "delete_my_account ya no exige AAL2", "if not public.aal_ok() then\n    raise exception 'mfa_required' using errcode = '28000';\n  end if;\n  delete from auth.users", "delete from auth.users"],
  ["08_eliminar_cuenta.sql", "delete_my_account borra cuentas ajenas", "delete from auth.users where id = uid;", "delete from auth.users;"],
  ["08_eliminar_cuenta.sql", "delete_my_account deja de fijar search_path", "security definer\nset search_path = ''", "security definer"],
  ["05_contenido_esquema.sql", "el cliente puede escribir en el contenido", "revoke all on\n  public.courses, public.categories, public.lessons, public.exercises, public.questions, public.answers\n  from anon, authenticated;", "select 1;"]
];
const suites = ["tests/sql.test.js", "tests/migrations.test.js", "tests/content.test.js"];
let survived = 0;
for (const [file, why, from, to] of MUT) {
  const p = mig(file), orig = fs.readFileSync(p, "utf8"), norm = orig.replace(/\r\n/g, "\n");
  const pairs = Array.isArray(from) ? from : [[from, to]];
  if (pairs.some(([f]) => !norm.includes(f))) { console.log("NO APLICABLE  " + file + " · " + why + " (el texto a mutar ya no existe)"); survived++; continue; }
  let mutated = norm; for (const [f, t] of pairs) mutated = mutated.replace(f, t);
  fs.writeFileSync(p, mutated, "utf8");
  let killedBy = null;
  try {
    for (const s of suites) { const r = cp.spawnSync(process.execPath, [path.join(root, s)], { encoding: "utf8", timeout: 300000 }); if (r.status !== 0) { killedBy = s.replace("tests/", ""); break; } }
  } finally { fs.writeFileSync(p, orig, "utf8"); }
  if (killedBy) console.log("DETECTADA     " + file + " · " + why + "  →  " + killedBy);
  else { survived++; console.log("¡SOBREVIVE!   " + file + " · " + why); }
}
console.log(`\n${MUT.length - survived}/${MUT.length} mutaciones detectadas` + (survived ? ` · ${survived} sin detectar` : ""));
process.exit(survived ? 1 : 0);
