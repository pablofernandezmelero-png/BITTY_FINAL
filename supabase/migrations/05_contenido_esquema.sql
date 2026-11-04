-- Bitty · migración 005: estructura de contenido (cursos, categorías, lecciones, ejercicios, preguntas, respuestas)
-- ADITIVA: solo crea tablas nuevas. No toca progress, profiles, stats ni xp_events.
-- El contenido es PÚBLICO de solo lectura: cualquiera puede leerlo, nadie puede escribirlo desde la app
-- (se carga con migraciones SQL). Las respuestas correctas son legibles porque ya viajan dentro de la app.
--
-- Equivalencias con la app actual (la app sigue leyendo sus bancos del HTML; esta base de datos es la
-- fuente de contenido para el futuro sin romper la compatibilidad):
--   courses     = las 4 rutas (g, py, js, java)
--   categories  = los 19 bancos de preguntas (cmp, hw, bin, ..., jve)
--   lessons     = los niveles de cada ruta (incluye los mini-boss)
--   exercises   = cómo se juega cada lección (hoy: generadores de la app)
--   questions   = las preguntas fijas de los bancos   · answers = sus opciones/pasos
-- Los 74 generadores de preguntas son código de la app y NO se migran.

create table if not exists public.courses (
  id         text primary key check (id ~ '^[a-z]{1,10}$'),
  position   smallint not null,
  name       jsonb not null check (name ?& array['es','en','nl']),
  icon       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id         text primary key check (id ~ '^[a-z0-9]{1,10}$'),
  course_id  text not null references public.courses(id),
  position   smallint not null,
  name       jsonb not null check (name ?& array['es','en','nl']),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id         uuid primary key default gen_random_uuid(),
  course_id  text not null references public.courses(id),
  position   smallint not null,
  title      jsonb not null check (title ?& array['es','en','nl']),
  is_boss    boolean not null default false,
  xp         smallint not null check (xp in (10, 40)),   -- mismas recompensas que award_xp (level 10 / boss 40)
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (course_id, position)
);

create table if not exists public.exercises (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references public.lessons(id) on delete cascade,
  position   smallint not null default 0,
  kind       text not null check (kind in ('quiz', 'boss')),
  config     jsonb not null default '{}'::jsonb,         -- hoy: {"source":"generator"}
  unique (lesson_id, position)
);

create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  legacy_key  text not null unique check (legacy_key ~ '^[a-z0-9]{1,10}:[0-9]{1,6}$'),  -- «banco:posición» en la app
  category_id text not null references public.categories(id),
  difficulty  smallint not null check (difficulty between 0 and 2),   -- 0 fácil · 1 normal · 2 difícil
  kind        text not null check (kind in ('choice', 'order')),
  prompt      jsonb not null check (prompt ?& array['es','en','nl']),
  format      text not null default 'html' check (format in ('html', 'text')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists questions_category_difficulty on public.questions (category_id, difficulty) where active;

create table if not exists public.answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  position    smallint not null,    -- choice: 0 = la correcta (la app mezcla las opciones) · order: orden correcto de los pasos
  is_correct  boolean not null,     -- choice: solo la 0 · order: todos los pasos
  text        jsonb not null check (text ?& array['es','en','nl']),
  unique (question_id, position)
);

-- ===== Seguridad: lectura pública, escritura solo mediante migraciones =====
alter table public.courses    enable row level security;
alter table public.categories enable row level security;
alter table public.lessons    enable row level security;
alter table public.exercises  enable row level security;
alter table public.questions  enable row level security;
alter table public.answers    enable row level security;

drop policy if exists "courses_read" on public.courses;
drop policy if exists "categories_read" on public.categories;
drop policy if exists "lessons_read" on public.lessons;
drop policy if exists "exercises_read" on public.exercises;
drop policy if exists "questions_read" on public.questions;
drop policy if exists "answers_read" on public.answers;
create policy "courses_read"    on public.courses    for select to anon, authenticated using (active);
create policy "categories_read" on public.categories for select to anon, authenticated using (active);
create policy "lessons_read"    on public.lessons    for select to anon, authenticated using (active);
create policy "exercises_read"  on public.exercises  for select to anon, authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id and l.active));
create policy "questions_read"  on public.questions  for select to anon, authenticated using (active);
create policy "answers_read"    on public.answers    for select to anon, authenticated
  using (exists (select 1 from public.questions q where q.id = question_id and q.active));

-- Sin políticas de insert/update/delete + permisos retirados: la app no puede modificar el contenido.
revoke insert, update, delete, truncate on
  public.courses, public.categories, public.lessons, public.exercises, public.questions, public.answers
  from anon, authenticated;
