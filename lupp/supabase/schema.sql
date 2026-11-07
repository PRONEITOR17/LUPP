-- =============================================================
--  LUPP · Base de datos en Supabase
--  Pega TODO este archivo en Supabase → SQL Editor → Run.
--  Se puede correr varias veces sin dañar nada.
--
--  Cada fila tiene user_id: Row Level Security (RLS) hace que
--  cada usuario SOLO pueda ver y cambiar lo suyo.
-- =============================================================

-- ---------- Cuentas (Efectivo, Nequi, Bancolombia…) ----------
create table if not exists public.cuentas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  espacio       text not null default 'personal' check (espacio in ('personal', 'empresa')),
  nombre        text not null,
  icono         text,
  logo          text,                       -- logo propio (imagen pequeña)
  saldo_inicial bigint not null default 0,
  orden         int not null default 0,
  created_at    timestamptz not null default now()
);
alter table public.cuentas add column if not exists logo text;

-- ---------- Categorías ----------
create table if not exists public.categorias (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  espacio    text not null default 'personal' check (espacio in ('personal', 'empresa')),
  nombre     text not null,
  tipo       text not null check (tipo in ('ingreso', 'gasto')),
  icono      text,
  color      text,
  created_at timestamptz not null default now()
);

-- ---------- Movimientos (ingresos, gastos, transferencias) ----------
create table if not exists public.movimientos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  espacio           text not null default 'personal' check (espacio in ('personal', 'empresa')),
  tipo              text not null check (tipo in ('ingreso', 'gasto', 'transferencia')),
  monto             bigint not null check (monto >= 0),
  cuenta_id         uuid references public.cuentas (id) on delete cascade,
  cuenta_destino_id uuid references public.cuentas (id) on delete cascade,
  categoria_id      uuid references public.categorias (id) on delete set null,
  fecha             date not null default current_date,
  nota              text,
  created_at        timestamptz not null default now()
);

-- ---------- Agenda ----------
create table if not exists public.actividades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo      text not null,
  fecha       date not null,
  hora_inicio text not null,               -- 'HH:MM'
  hora_fin    text,
  repetir     text not null default 'nunca' check (repetir in ('nunca', 'diario', 'semanal', 'mensual')),
  dias        int[] not null default '{}',
  hasta       date,
  excepciones jsonb not null default '[]',
  avisos      jsonb not null default '[]',
  monto       bigint,
  cuenta_id   uuid references public.cuentas (id) on delete set null,
  pagados     jsonb not null default '[]',
  created_at  timestamptz not null default now()
);

-- ---------- Pendientes ----------
create table if not exists public.tareas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo     text not null,
  fecha      date not null default current_date,
  hecha      boolean not null default false,
  prioridad  text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  created_at timestamptz not null default now()
);

-- ---------- Diario (una entrada por día) ----------
create table if not exists public.diario (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha      date not null,
  texto      text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, fecha)
);

-- ---------- Deudas (me deben / debo) ----------
create table if not exists public.deudas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  espacio    text not null default 'personal' check (espacio in ('personal', 'empresa')),
  tipo       text not null check (tipo in ('me_deben', 'debo')),
  nombre     text not null,
  monto      bigint not null check (monto >= 0),
  fecha      date,
  nota       text,
  foto       text,                         -- foto pequeña de la persona
  ahorrado   bigint not null default 0,
  abonos     jsonb not null default '[]',  -- [{id, monto, fecha, nota, cuenta_id}]
  created_at timestamptz not null default now()
);

-- ---------- Índices para que todo cargue rápido ----------
create index if not exists cuentas_user_idx     on public.cuentas (user_id);
create index if not exists categorias_user_idx  on public.categorias (user_id);
create index if not exists movimientos_user_idx on public.movimientos (user_id, fecha);
create index if not exists actividades_user_idx on public.actividades (user_id);
create index if not exists tareas_user_idx      on public.tareas (user_id, fecha);
create index if not exists diario_user_idx      on public.diario (user_id, fecha);
create index if not exists deudas_user_idx      on public.deudas (user_id);

-- ---------- Seguridad: cada quien ve SOLO lo suyo ----------
do $$
declare
  t text;
begin
  foreach t in array array['cuentas', 'categorias', 'movimientos', 'actividades', 'tareas', 'diario', 'deudas']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo lo mio" on public.%I', t);
    execute format(
      'create policy "solo lo mio" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$; 