-- Bitty · migración 004: XP y estadísticas validados en el servidor
-- ADITIVA y compatible con el progreso existente:
--   * no borra ni reinicia ninguna fila; el XP que ya había se conserva como "base_xp";
--   * a partir de ahora el cliente NO puede escribir en `stats`: solo lee, y el XP
--     se suma llamando a la función `award_xp`, que valida cada recompensa.
-- Ejecútala en Supabase -> SQL Editor (después de la 003). Se puede ejecutar más de una vez.
--
-- Límites de abuso (el servidor NO puede saber si de verdad se jugó el nivel, así que acota el daño):
--   * referencias de recompensa con formato fijo y una sola vez por cuenta (nivel, jefe, especial, reto);
--   * 1 evento cada 8 s, 3.000 XP por cada 24 h, repeticiones (replay) 500 XP/24 h, anuncios 3/24 h;
--   * todo se mide con la hora del SERVIDOR, no con la fecha que envía el cliente.

-- ===== Columnas nuevas en stats =====
alter table public.stats add column if not exists base_xp integer not null default 0 check (base_xp >= 0);
alter table public.stats add column if not exists legacy_imported boolean not null default false;

-- ===== Registro de eventos de XP (auditable e idempotente) =====
create table if not exists public.xp_events (
  id         uuid primary key,                       -- lo genera el cliente: reintentar no duplica
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('level','boss','special','challenge','replay','ad')),
  ref        text not null check (ref ~ '^[a-z0-9:_-]{1,80}$'),
  xp         integer not null check (xp > 0 and xp <= 500),
  day        date not null,
  created_at timestamptz not null default now()
);
create index if not exists xp_events_user_day on public.xp_events (user_id, day);
create index if not exists xp_events_user_created on public.xp_events (user_id, created_at desc);
-- Las recompensas "de primera vez" solo se pueden cobrar una vez por cuenta y referencia.
create unique index if not exists xp_events_once on public.xp_events (user_id, ref)
  where kind in ('level','boss','special','challenge','ad');

-- Filas de stats que ya existían ANTES de esta migración: su XP actual pasa a ser la base y se marcan
-- como importadas. Solo se tocan las que no tienen eventos, así que repetir la migración no falsea nada.
update public.stats s set base_xp = s.xp, legacy_imported = true
where s.legacy_imported = false
  and not exists (select 1 from public.xp_events e where e.user_id = s.user_id);

alter table public.xp_events enable row level security;
drop policy if exists "xp_events_select_own" on public.xp_events;
create policy "xp_events_select_own" on public.xp_events for select to authenticated using (auth.uid() = user_id);
drop policy if exists "xp_events_require_aal" on public.xp_events;
create policy "xp_events_require_aal" on public.xp_events as restrictive for select to authenticated using (public.aal_ok());
-- Solo lectura para el cliente (sin insert/update/delete/truncate): escribe únicamente award_xp (security definer).
revoke all on public.xp_events from anon, authenticated;
grant select on public.xp_events to authenticated;

-- ===== stats pasa a ser de solo lectura para el cliente =====
drop policy if exists "stats_insert_own" on public.stats;
drop policy if exists "stats_update_own" on public.stats;
revoke all on public.stats from anon, authenticated;
grant select on public.stats to authenticated;

-- ===== Función: conceder XP =====
-- Recompensas (idénticas a las de la app):
--   level 10 · boss 40 · special 50 · challenge 50/80/130 (diario) y 180/300/480 (semanal) · replay 5 · ad 10
-- Referencias admitidas:
--   level/boss  lv:<ruta>:<dificultad 0-2>:<posición 0-99>      special  sp:<n>:<dificultad>
--   challenge   ch:d|w:<AAAA-MM-DD>:<dificultad>                replay   re:<uuid>        ad  ad:<día>:1..3
create or replace function public.award_xp(
  p_event_id uuid,
  p_kind     text,
  p_ref      text,
  p_xp       integer,
  p_day      date
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid        uuid := auth.uid();
  v_stats    public.stats%rowtype;
  v_today    date := (now() at time zone 'utc')::date;
  v_last     timestamptz;
  v_day_xp   integer;
  v_rep_xp   integer;
  v_ads      integer;
  v_streak   integer;
  v_inserted integer;
  v_m        text[];
  v_cdate    date;
  v_dif      integer;
  v_expected integer;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.aal_ok() then
    raise exception 'mfa_required' using errcode = '28000';
  end if;
  if p_event_id is null or p_kind is null or p_ref is null or p_xp is null or p_day is null then
    raise exception 'invalid_args' using errcode = '22023';
  end if;
  if p_ref !~ '^[a-z0-9:_-]{1,80}$' then
    raise exception 'invalid_ref' using errcode = '22023';
  end if;
  -- la fecha del cliente (su zona horaria) solo puede diferir un día de la del servidor
  if p_day < v_today - 1 or p_day > v_today + 1 then
    raise exception 'invalid_day' using errcode = '22023';
  end if;

  -- cantidad coherente con el tipo
  if not (
       (p_kind = 'level'     and p_xp = 10)
    or (p_kind = 'boss'      and p_xp = 40)
    or (p_kind = 'special'   and p_xp = 50)
    or (p_kind = 'challenge' and p_xp in (50, 80, 130, 180, 300, 480))
    or (p_kind = 'replay'    and p_xp = 5)
    or (p_kind = 'ad'        and p_xp = 10)
  ) then
    raise exception 'invalid_reward' using errcode = '22023';
  end if;

  -- formato de la referencia según el tipo (impide inventar referencias para cobrar XP infinito)
  if p_kind in ('level', 'boss') then
    if p_ref !~ '^lv:(g|py|js|java):[0-2]:[0-9]{1,2}$' then raise exception 'invalid_ref' using errcode = '22023'; end if;
  elsif p_kind = 'special' then
    if p_ref !~ '^sp:[0-9]{1,2}:[0-2]$' then raise exception 'invalid_ref' using errcode = '22023'; end if;
  elsif p_kind = 'replay' then
    if p_ref !~ '^re:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid_ref' using errcode = '22023'; end if;
  elsif p_kind = 'ad' then
    if p_ref not in ('ad:' || p_day::text || ':1', 'ad:' || p_day::text || ':2', 'ad:' || p_day::text || ':3') then
      raise exception 'invalid_ref' using errcode = '22023';
    end if;
  elsif p_kind = 'challenge' then
    v_m := regexp_match(p_ref, '^ch:(d|w):([0-9]{4}-[0-9]{2}-[0-9]{2}):([0-2])$');
    if v_m is null then raise exception 'invalid_ref' using errcode = '22023'; end if;
    begin
      v_cdate := v_m[2]::date;
    exception when others then
      raise exception 'invalid_ref' using errcode = '22023';
    end;
    v_dif := v_m[3]::integer;
    if v_m[1] = 'd' then
      v_expected := (array[50, 80, 130])[v_dif + 1];
      if abs(v_cdate - p_day) > 1 then raise exception 'invalid_ref' using errcode = '22023'; end if;
    else
      v_expected := (array[180, 300, 480])[v_dif + 1];
      if v_cdate < p_day - 7 or v_cdate > p_day + 1 then raise exception 'invalid_ref' using errcode = '22023'; end if;
    end if;
    if p_xp <> v_expected then raise exception 'invalid_reward' using errcode = '22023'; end if;
  end if;

  -- un solo evento a la vez por usuario (evita carreras entre llamadas simultáneas)
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  -- reintento del mismo evento: no hace nada y devuelve el estado actual
  if exists (select 1 from public.xp_events where id = p_event_id) then
    if not exists (select 1 from public.xp_events where id = p_event_id and user_id = uid) then
      raise exception 'invalid_event' using errcode = '22023';
    end if;
    select * into v_stats from public.stats where user_id = uid;
    return jsonb_build_object('awarded', 0, 'duplicate', true,
      'xp', coalesce(v_stats.xp, 0), 'streak', coalesce(v_stats.streak, 0));
  end if;

  -- ritmo: no más de un evento cada 8 segundos
  select max(created_at) into v_last from public.xp_events where user_id = uid;
  if v_last is not null and v_last > now() - interval '8 seconds' then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  -- topes en las últimas 24 h, con la hora del servidor
  select coalesce(sum(xp), 0),
         coalesce(sum(xp) filter (where kind = 'replay'), 0),
         count(*) filter (where kind = 'ad')
    into v_day_xp, v_rep_xp, v_ads
  from public.xp_events
  where user_id = uid and created_at > now() - interval '24 hours';
  if v_day_xp + p_xp > 3000 then
    raise exception 'daily_cap' using errcode = '54000';
  end if;
  if p_kind = 'replay' and v_rep_xp + p_xp > 500 then
    raise exception 'replay_cap' using errcode = '54000';
  end if;
  if p_kind = 'ad' and v_ads >= 3 then
    raise exception 'ad_cap' using errcode = '54000';
  end if;

  insert into public.xp_events (id, user_id, kind, ref, xp, day)
  values (p_event_id, uid, p_kind, p_ref, p_xp, p_day)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    -- recompensa de primera vez ya cobrada
    select * into v_stats from public.stats where user_id = uid;
    return jsonb_build_object('awarded', 0, 'duplicate', true,
      'xp', coalesce(v_stats.xp, 0), 'streak', coalesce(v_stats.streak, 0));
  end if;

  insert into public.stats (user_id) values (uid) on conflict (user_id) do nothing;
  select * into v_stats from public.stats where user_id = uid for update;

  -- racha: mismo día no cambia, día siguiente suma, hueco la reinicia
  if v_stats.last_day is null or p_day > v_stats.last_day then
    v_streak := case when v_stats.last_day is not null and p_day = v_stats.last_day + 1
                     then v_stats.streak + 1 else 1 end;
    v_stats.last_day := p_day;
  else
    v_streak := v_stats.streak;
  end if;

  update public.stats set
    xp          = least(xp + p_xp, 100000000),
    streak      = least(v_streak, 100000),
    last_day    = v_stats.last_day,
    levels_done = levels_done + case when p_kind in ('level','boss') then 1 else 0 end,
    updated_at  = now()
  where user_id = uid
  returning * into v_stats;

  return jsonb_build_object('awarded', p_xp, 'duplicate', false,
    'xp', v_stats.xp, 'streak', v_stats.streak);
end;
$$;

-- ===== Función: importar el progreso local (una sola vez por cuenta) =====
-- Para quien jugó como invitado y luego crea cuenta. Es la única parte basada en confianza:
-- se acepta una vez, con tope (20.000 XP), y no se puede repetir ni sobrescribir.
create or replace function public.import_legacy_stats(
  p_xp integer, p_streak integer, p_last date, p_levels integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  v_stats public.stats%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.aal_ok() then
    raise exception 'mfa_required' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select * into v_stats from public.stats where user_id = uid;
  if found and (v_stats.legacy_imported or exists (select 1 from public.xp_events where user_id = uid)) then
    return jsonb_build_object('imported', false, 'xp', v_stats.xp, 'streak', v_stats.streak);
  end if;
  insert into public.stats (user_id, xp, base_xp, streak, last_day, levels_done, legacy_imported)
  values (uid,
    greatest(0, least(coalesce(p_xp, 0), 20000)),
    greatest(0, least(coalesce(p_xp, 0), 20000)),
    greatest(0, least(coalesce(p_streak, 0), 400)),
    case when p_last between (now() at time zone 'utc')::date - 400 and (now() at time zone 'utc')::date + 1 then p_last end,
    greatest(0, least(coalesce(p_levels, 0), 1000)),
    true)
  on conflict (user_id) do update set
    xp = excluded.xp, base_xp = excluded.base_xp, streak = excluded.streak,
    last_day = excluded.last_day, levels_done = excluded.levels_done,
    legacy_imported = true, updated_at = now()
  where public.stats.legacy_imported = false
    and not exists (select 1 from public.xp_events e where e.user_id = public.stats.user_id)
  returning * into v_stats;
  if not found then
    select * into v_stats from public.stats where user_id = uid;
    return jsonb_build_object('imported', false, 'xp', coalesce(v_stats.xp, 0), 'streak', coalesce(v_stats.streak, 0));
  end if;
  return jsonb_build_object('imported', true, 'xp', v_stats.xp, 'streak', v_stats.streak);
end;
$$;

-- Solo usuarios con sesión pueden llamarlas (nunca anon).
revoke all on function public.award_xp(uuid, text, text, integer, date) from public, anon;
revoke all on function public.import_legacy_stats(integer, integer, date, integer) from public, anon;
grant execute on function public.award_xp(uuid, text, text, integer, date) to authenticated;
grant execute on function public.import_legacy_stats(integer, integer, date, integer) to authenticated;
