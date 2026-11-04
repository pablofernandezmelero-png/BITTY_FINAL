-- Bitty · migración 007: registro de actividad e historial de preguntas
-- ADITIVA: solo crea una vista, una tabla y una función. No modifica ni borra datos existentes.
-- Requiere las migraciones 003 (aal_ok) y 004 (xp_events).
--
-- * activity_log: vista de SOLO LECTURA sobre xp_events (cada recompensa de XP es una actividad).
--   Usa los permisos de quien consulta (security_invoker), así que RLS y AAL2 se aplican igual.
-- * question_history: preguntas ya vistas por usuario, ruta y dificultad. Se escribe SOLO con
--   add_question_history (tope de 40.000 por usuario: al llegar, se descartan las más antiguas).
--   Hoy la app guarda este historial dentro de progress.data; esta tabla es la base para sacarlo de ahí.
--   El cliente todavía NO la usa (ver README: pendiente de conectar).

create or replace view public.activity_log with (security_invoker = true) as
  select id, user_id, kind, ref, xp, day, created_at from public.xp_events;
revoke all on public.activity_log from anon, authenticated;
grant select on public.activity_log to authenticated;

create table if not exists public.question_history (
  user_id    uuid not null references auth.users(id) on delete cascade,
  qkey       text not null check (char_length(qkey) between 1 and 200),
  track      text not null check (track in ('g', 'py', 'js', 'java')),
  difficulty smallint not null check (difficulty between 0 and 2),
  seen_at    timestamptz not null default now(),
  primary key (user_id, track, difficulty, qkey)
);
create index if not exists question_history_recent on public.question_history (user_id, seen_at);

alter table public.question_history enable row level security;
drop policy if exists "question_history_select_own" on public.question_history;
drop policy if exists "question_history_require_aal" on public.question_history;
create policy "question_history_select_own" on public.question_history for select to authenticated using (auth.uid() = user_id);
create policy "question_history_require_aal" on public.question_history as restrictive for select to authenticated using (public.aal_ok());
revoke insert, update, delete on public.question_history from anon, authenticated;

-- p_items: [{"k": "texto-o-id", "t": "g", "d": 1}, ...]  (máx. 500 por llamada)
create or replace function public.add_question_history(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  v_added integer;
  v_total integer;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.aal_ok() then
    raise exception 'mfa_required' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'invalid_args' using errcode = '22023';
  end if;

  insert into public.question_history (user_id, qkey, track, difficulty)
  select uid, x.k, x.t, x.d
  from jsonb_to_recordset(p_items) as x(k text, t text, d int)
  where x.k is not null and char_length(x.k) between 1 and 200
    and x.t in ('g', 'py', 'js', 'java') and x.d between 0 and 2
  on conflict do nothing;
  get diagnostics v_added = row_count;

  -- tope por usuario: se descartan las más antiguas
  select count(*) into v_total from public.question_history where user_id = uid;
  if v_total > 40000 then
    delete from public.question_history h
    where h.ctid in (
      select ctid from public.question_history
      where user_id = uid order by seen_at asc, qkey asc limit (v_total - 40000)
    );
  end if;
  return v_added;
end;
$$;
revoke all on function public.add_question_history(jsonb) from public, anon;
grant execute on function public.add_question_history(jsonb) to authenticated;
