-- Bitty · esquema de Supabase
-- Pégalo en: Supabase → SQL Editor → New query → Run

create table if not exists public.progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint progress_size check (pg_column_size(data) < 2000000)
);

alter table public.progress enable row level security;

-- Cada jugador solo puede ver y modificar SU fila.
create policy "progress_select_own" on public.progress
  for select to authenticated using (auth.uid() = user_id);

create policy "progress_insert_own" on public.progress
  for insert to authenticated with check (auth.uid() = user_id);

create policy "progress_update_own" on public.progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "progress_delete_own" on public.progress
  for delete to authenticated using (auth.uid() = user_id);

-- Nada para usuarios anónimos (sin políticas = acceso denegado).
