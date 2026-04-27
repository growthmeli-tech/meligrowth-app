-- ============================================================
-- Migración 0004: Modelo 360° y 360° Copilot
-- Nuevos roles, entidades de dominio y permisos
-- ============================================================

-- ─── 1. NUEVOS ENUMS ─────────────────────────────────────────

-- Nuevos roles del sistema
create type user_role_v2 as enum (
  'super_admin_meli_growth',
  'internal_operator_meli_growth',
  'client_manager',
  'client_operator'
);

-- Planes comerciales
create type plan_type as enum (
  '360',
  '360_copilot'
);

-- ─── 2. TABLA COMPANIES ──────────────────────────────────────
-- La empresa cliente. Agrupa usuarios, plan y cuentas ML.

create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  plan          plan_type not null default '360',
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── 3. TABLA ML_ACCOUNTS ────────────────────────────────────
-- La cuenta de Mercado Libre. Entidad central del sistema.
-- Una company puede tener múltiples cuentas ML en el futuro.

create table public.ml_accounts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  seller_id       text,
  account_name    text not null,
  active          boolean not null default true,
  meli_account_url text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── 4. TABLA USERS V2 ───────────────────────────────────────
-- Usuarios con el nuevo sistema de roles

create table public.users_v2 (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  name        text,
  role        user_role_v2 not null,
  company_id  uuid references public.companies(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ─── 5. TABLA USER_ACCOUNT_ACCESS ────────────────────────────
-- Permisos flexibles: una persona puede tener
-- múltiples roles sobre múltiples cuentas ML.
-- Resuelve el caso donde el dueño es también operador.

create table public.user_account_access (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users_v2(id) on delete cascade,
  ml_account_id uuid not null references public.ml_accounts(id) on delete cascade,
  access_type text not null check (access_type in ('manager', 'operator', 'internal')),
  created_at  timestamptz not null default now(),
  unique(user_id, ml_account_id, access_type)
);

-- ─── 6. TABLA METRIC_SNAPSHOTS ───────────────────────────────
-- Foto diaria de métricas normalizadas por cuenta ML.
-- Separa los datos crudos del scoring.

create table public.metric_snapshots (
  id              uuid primary key default gen_random_uuid(),
  ml_account_id   uuid not null references public.ml_accounts(id) on delete cascade,
  snapshot_date   date not null default current_date,
  source          text not null default 'manual'
                  check (source in ('api', 'scraper', 'manual', 'csv')),
  -- Bloque 01 Salud
  reclamos              numeric,
  mediaciones           numeric,
  cancelaciones_vendedor numeric,
  envios_a_tiempo       numeric,
  -- Bloque 02 Publicaciones
  pubs_activas_pct      numeric,
  pubs_optimizadas_pct  numeric,
  ctr                   numeric,
  -- Bloque 03 Ads
  margen_pre_ads        numeric,
  gasto_ads             numeric,
  ventas_ads            numeric,
  ventas_totales        numeric,
  acos                  numeric,
  roas                  numeric,
  tacos                 numeric,
  -- Bloque 04 Logística
  incidencias_pct       numeric,
  uso_full_flex_pct     numeric,
  cancelaciones_stock_pct numeric,
  -- Bloque 05 Stock
  skus_sin_stock_pct    numeric,
  dias_stock            numeric,
  lead_time_reposicion  numeric,
  sistema_reposicion    numeric,
  -- Metadata de fuentes por bloque
  data_sources          jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  unique(ml_account_id, snapshot_date)
);

-- ─── 7. TABLA ACCOUNT_HEALTH ─────────────────────────────────
-- Resultado del scoring por snapshot.
-- Separado de metric_snapshots para poder recalcular sin
-- perder los datos crudos.

create table public.account_health (
  id              uuid primary key default gen_random_uuid(),
  ml_account_id   uuid not null references public.ml_accounts(id) on delete cascade,
  snapshot_id     uuid not null references public.metric_snapshots(id) on delete cascade,
  snapshot_date   date not null,
  score_global    numeric not null,
  estado_global   text not null,
  score_salud     numeric,
  score_publicaciones numeric,
  score_ads       numeric,
  score_logistica numeric,
  score_stock     numeric,
  created_at      timestamptz not null default now()
);

-- ─── 8. TABLA ALERTS ─────────────────────────────────────────
-- Señales accionables generadas por el motor de recomendaciones.

create table public.alerts (
  id              uuid primary key default gen_random_uuid(),
  ml_account_id   uuid not null references public.ml_accounts(id) on delete cascade,
  health_id       uuid references public.account_health(id) on delete set null,
  categoria       text not null,
  prioridad       text not null check (prioridad in ('urgente', 'alta', 'media', 'baja')),
  titulo          text not null,
  descripcion     text,
  accion_concreta text,
  benchmark_objetivo text,
  audiencia       text not null check (audiencia in ('internal', 'manager', 'operator', 'all')),
  resuelta        boolean not null default false,
  resuelta_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ─── 9. TABLA TASKS ──────────────────────────────────────────
-- Acciones operativas asignadas a un operador.

create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  ml_account_id   uuid not null references public.ml_accounts(id) on delete cascade,
  alert_id        uuid references public.alerts(id) on delete set null,
  assigned_to     uuid references public.users_v2(id) on delete set null,
  titulo          text not null,
  descripcion     text,
  prioridad       text not null check (prioridad in ('urgente', 'alta', 'media', 'baja')),
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'en_curso', 'completada', 'descartada')),
  due_date        date,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- ─── 10. TABLA TASK_EVENTS ───────────────────────────────────
-- Trazabilidad de cada cambio en una tarea.

create table public.task_events (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid references public.users_v2(id) on delete set null,
  evento      text not null,
  detalle     text,
  created_at  timestamptz not null default now()
);

-- ─── 11. TABLA INGESTION_RUNS ────────────────────────────────
-- Registro de cada corrida de ingestión de datos.

create table public.ingestion_runs (
  id              uuid primary key default gen_random_uuid(),
  ml_account_id   uuid not null references public.ml_accounts(id) on delete cascade,
  source          text not null check (source in ('api', 'scraper', 'manual', 'csv')),
  status          text not null check (status in ('pending', 'running', 'success', 'error')),
  blocks_fetched  jsonb not null default '{}'::jsonb,
  error_msg       text,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ─── 12. ÍNDICES ─────────────────────────────────────────────

create index idx_companies_active
  on public.companies (active);

create index idx_ml_accounts_company
  on public.ml_accounts (company_id, active);

create index idx_users_v2_role
  on public.users_v2 (role);

create index idx_users_v2_company
  on public.users_v2 (company_id);

create index idx_access_user
  on public.user_account_access (user_id);

create index idx_access_account
  on public.user_account_access (ml_account_id);

create index idx_snapshots_account_date
  on public.metric_snapshots (ml_account_id, snapshot_date desc);

create index idx_health_account_date
  on public.account_health (ml_account_id, snapshot_date desc);

create index idx_alerts_account_prioridad
  on public.alerts (ml_account_id, prioridad, resuelta);

create index idx_tasks_account_estado
  on public.tasks (ml_account_id, estado, prioridad);

create index idx_tasks_assigned
  on public.tasks (assigned_to, estado);

-- ─── 13. ROW LEVEL SECURITY ──────────────────────────────────

alter table public.companies enable row level security;
alter table public.ml_accounts enable row level security;
alter table public.users_v2 enable row level security;
alter table public.user_account_access enable row level security;
alter table public.metric_snapshots enable row level security;
alter table public.account_health enable row level security;
alter table public.alerts enable row level security;
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;
alter table public.ingestion_runs enable row level security;

-- ─── 14. FUNCIONES DE AUTORIZACIÓN ───────────────────────────

-- Obtener el rol del usuario autenticado
create or replace function public.get_user_role_v2()
returns user_role_v2 language sql stable security definer as $$
  select role from public.users_v2 where id = auth.uid()
$$;

-- Verificar si el usuario es del equipo interno de MG
create or replace function public.is_meli_growth_team()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.users_v2
    where id = auth.uid()
    and role in ('super_admin_meli_growth', 'internal_operator_meli_growth')
  )
$$;

-- Verificar si el usuario tiene acceso a una cuenta ML específica
create or replace function public.can_access_ml_account(target_account_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.user_account_access
    where user_id = auth.uid()
    and ml_account_id = target_account_id
  ) or public.is_meli_growth_team()
$$;

-- Verificar si el usuario tiene un tipo de acceso específico
create or replace function public.has_access_type(target_account_id uuid, required_access text)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.user_account_access
    where user_id = auth.uid()
    and ml_account_id = target_account_id
    and access_type = required_access
  ) or public.is_meli_growth_team()
$$;

-- ─── 15. POLÍTICAS RLS ───────────────────────────────────────

-- Companies
create policy "meli growth team reads all companies"
  on public.companies for select
  using (public.is_meli_growth_team());

create policy "client users read own company"
  on public.companies for select
  using (
    id = (select company_id from public.users_v2 where id = auth.uid())
  );

create policy "super admin manages companies"
  on public.companies for all
  using (public.get_user_role_v2() = 'super_admin_meli_growth');

-- ML Accounts
create policy "meli growth team reads all ml accounts"
  on public.ml_accounts for select
  using (public.is_meli_growth_team());

create policy "users read accessible ml accounts"
  on public.ml_accounts for select
  using (public.can_access_ml_account(id));

create policy "internal team manages ml accounts"
  on public.ml_accounts for all
  using (public.is_meli_growth_team());

-- Users V2
create policy "users read self v2"
  on public.users_v2 for select
  using (id = auth.uid());

create policy "meli growth team reads all users"
  on public.users_v2 for select
  using (public.is_meli_growth_team());

-- User Account Access
create policy "users read own access"
  on public.user_account_access for select
  using (user_id = auth.uid());

create policy "meli growth team manages access"
  on public.user_account_access for all
  using (public.is_meli_growth_team());

-- Metric Snapshots
create policy "users read accessible snapshots"
  on public.metric_snapshots for select
  using (public.can_access_ml_account(ml_account_id));

create policy "internal team manages snapshots"
  on public.metric_snapshots for all
  using (public.is_meli_growth_team());

-- Account Health
create policy "users read accessible health"
  on public.account_health for select
  using (public.can_access_ml_account(ml_account_id));

create policy "internal team manages health"
  on public.account_health for all
  using (public.is_meli_growth_team());

-- Alerts
create policy "internal team reads all alerts"
  on public.alerts for select
  using (public.is_meli_growth_team());

create policy "managers read strategic alerts"
  on public.alerts for select
  using (
    public.can_access_ml_account(ml_account_id)
    and audiencia in ('manager', 'all')
    and public.get_user_role_v2() = 'client_manager'
  );

create policy "operators read operational alerts"
  on public.alerts for select
  using (
    public.can_access_ml_account(ml_account_id)
    and audiencia in ('operator', 'all')
    and public.get_user_role_v2() = 'client_operator'
  );

create policy "internal team manages alerts"
  on public.alerts for all
  using (public.is_meli_growth_team());

-- Tasks
create policy "internal team reads all tasks"
  on public.tasks for select
  using (public.is_meli_growth_team());

create policy "operators read own account tasks"
  on public.tasks for select
  using (
    public.can_access_ml_account(ml_account_id)
    and public.get_user_role_v2() = 'client_operator'
  );

create policy "internal team manages tasks"
  on public.tasks for all
  using (public.is_meli_growth_team());

-- Task Events
create policy "users read task events"
  on public.task_events for select
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
      and public.can_access_ml_account(t.ml_account_id)
    )
  );

-- Ingestion Runs
create policy "internal team manages ingestion runs"
  on public.ingestion_runs for all
  using (public.is_meli_growth_team());

-- ─── 16. TRIGGERS ────────────────────────────────────────────

-- Auto-actualizar updated_at en companies
create or replace function public.touch_updated_at_v2()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_touch_updated_at
  before update on public.companies
  for each row execute function public.touch_updated_at_v2();

create trigger ml_accounts_touch_updated_at
  before update on public.ml_accounts
  for each row execute function public.touch_updated_at_v2();

-- Auto-crear users_v2 cuando se crea un auth user
create or replace function public.handle_new_auth_user_v2()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users_v2 (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(
      (new.raw_user_meta_data->>'role')::user_role_v2,
      'client_manager'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created_v2
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_v2();