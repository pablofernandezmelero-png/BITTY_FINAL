-- Bitty · migración 002: perfiles y estadísticas
-- ADITIVA: solo crea tablas, políticas y un trigger. No borra ni modifica datos existentes.
-- Ejecútala en Supabase → SQL Editor → New query → Run (después de supabase-schema.sql).

-- ===== Perfiles: un registro por cuenta =====
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 14),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- (sin política de delete: el perfil se borra solo si se borra la cuenta, por "on delete cascade")

-- ===== Estadísticas: XP, racha y niveles superados =====
create table if not exists public.stats (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  xp           integer not null default 0 check (xp >= 0 and xp <= 100000000),
  streak       integer not null default 0 check (streak >= 0 and streak <= 100000),
  last_day     date,
  levels_done  integer not null default 0 check (levels_done >= 0 and levels_done <= 100000),
  updated_at   timestamptz not null default now()
);
alter table public.stats enable row level security;

drop policy if exists "stats_select_own" on public.stats;
drop policy if exists "stats_insert_own" on public.stats;
drop policy if exists "stats_update_own" on public.stats;
create policy "stats_select_own" on public.stats for select to authenticated using (auth.uid() = user_id);
create policy "stats_insert_own" on public.stats for insert to authenticated with check (auth.uid() = user_id);
create policy "stats_update_own" on public.stats for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== Al crear una cuenta nueva, se crea su perfil automáticamente =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para las cuentas que ya existían antes de esta migración
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
