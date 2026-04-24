create type user_role as enum ('operator', 'client');
create type client_plan as enum ('starter', 'growth', 'scale');
create type diagnostic_source as enum ('manual', 'scraping', 'import');
create type action_priority as enum ('urgente', 'alta', 'media');
create type action_status as enum ('pendiente', 'en_curso', 'completada');
create type file_type as enum ('skus_stock', 'margenes', 'ficha_tecnica', 'otro');
create type scraping_type as enum ('salud', 'ads', 'publicaciones', 'stock');
create type scraping_status as enum ('pending', 'running', 'success', 'error');
create type notification_type as enum ('score_bajo', 'alerta_critica', 'accion_completada', 'archivo_procesado', 'reporte_semanal');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  role user_role not null,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  plan client_plan not null default 'starter',
  operator_id uuid references public.users(id),
  client_user_id uuid references public.users(id),
  meli_account_url text,
  meli_seller_id text,
  created_at timestamptz not null default now(),
  active boolean not null default true
);

create table public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  date date not null default current_date,
  score_global numeric not null,
  estado_global text not null,
  reclamos numeric, mediaciones numeric, cancelaciones_vendedor numeric, envios_a_tiempo numeric, score_salud numeric,
  pubs_activas_pct numeric, pubs_optimizadas_pct numeric, ctr numeric, score_publicaciones numeric,
  margen_pre_ads numeric, gasto_ads numeric, ventas_ads numeric, ventas_totales numeric, acos numeric, roas numeric, tacos numeric, score_ads numeric,
  incidencias_pct numeric, uso_full_flex_pct numeric, cancelaciones_stock_pct numeric, score_logistica numeric,
  skus_sin_stock_pct numeric, dias_stock numeric, lead_time_reposicion numeric, sistema_reposicion numeric, score_stock numeric,
  created_by uuid references public.users(id),
  source diagnostic_source not null default 'manual',
  created_at timestamptz not null default now()
);

create table public.score_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  date date not null,
  score_global numeric not null,
  score_salud numeric,
  score_pubs numeric,
  score_ads numeric,
  score_logistica numeric,
  score_stock numeric
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid references public.users(id),
  bloque text not null,
  titulo text not null,
  descripcion text,
  prioridad action_priority not null,
  estado action_status not null default 'pendiente',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  uploaded_by uuid references public.users(id),
  tipo file_type not null default 'otro',
  filename text not null,
  storage_path text not null,
  size_bytes bigint,
  procesado boolean not null default false,
  procesado_at timestamptz,
  error_procesamiento text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  sku text not null,
  stock numeric,
  title text,
  description text,
  last_file_id uuid references public.client_files(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (client_id, sku)
);

create table public.margins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  sku text not null,
  costo numeric,
  precio numeric,
  margen numeric,
  last_file_id uuid references public.client_files(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (client_id, sku)
);

create table public.product_specs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  sku text not null,
  titulo text,
  descripcion text,
  attributes jsonb not null default '{}'::jsonb,
  last_file_id uuid references public.client_files(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (client_id, sku)
);

create table public.scraping_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  tipo scraping_type not null,
  estado scraping_status not null default 'pending',
  resultado_json jsonb,
  error_msg text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  tipo notification_type not null,
  titulo text not null,
  mensaje text not null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  email text not null,
  resend_email_id text,
  score_global numeric,
  score_delta numeric,
  status text not null default 'pending',
  error_msg text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-files',
  'client-files',
  false,
  10485760,
  array[
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet'
  ]
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meli-sessions',
  'meli-sessions',
  false,
  5242880,
  array['application/json']
)
on conflict (id) do nothing;

alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.diagnostics enable row level security;
alter table public.score_history enable row level security;
alter table public.actions enable row level security;
alter table public.client_files enable row level security;
alter table public.products enable row level security;
alter table public.margins enable row level security;
alter table public.product_specs enable row level security;
alter table public.scraping_jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.weekly_reports enable row level security;

create function public.current_user_role()
returns user_role language sql stable security definer as $$
  select role from public.users where id = auth.uid()
$$;

create function public.can_access_client(target_client_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from public.clients c
    where c.id = target_client_id
      and (
        c.operator_id = auth.uid()
        or c.client_user_id = auth.uid()
      )
  )
$$;

create function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'client')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create function public.insert_score_history_from_diagnostic()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.score_history (
    client_id,
    date,
    score_global,
    score_salud,
    score_pubs,
    score_ads,
    score_logistica,
    score_stock
  ) values (
    new.client_id,
    new.date,
    new.score_global,
    new.score_salud,
    new.score_publicaciones,
    new.score_ads,
    new.score_logistica,
    new.score_stock
  );
  return new;
end;
$$;

create trigger on_diagnostic_insert_score_history
  after insert on public.diagnostics
  for each row execute function public.insert_score_history_from_diagnostic();

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_products_update_touch
  before update on public.products
  for each row execute function public.touch_updated_at();

create trigger on_margins_update_touch
  before update on public.margins
  for each row execute function public.touch_updated_at();

create trigger on_product_specs_update_touch
  before update on public.product_specs
  for each row execute function public.touch_updated_at();

create index idx_clients_operator_active on public.clients (operator_id, active);
create index idx_clients_client_user on public.clients (client_user_id);
create index idx_diagnostics_client_date on public.diagnostics (client_id, date desc, created_at desc);
create index idx_score_history_client_date on public.score_history (client_id, date);
create index idx_actions_client_status_priority on public.actions (client_id, estado, prioridad);
create index idx_client_files_client_created on public.client_files (client_id, created_at desc);
create index idx_notifications_user_unread_created on public.notifications (user_id, leida, created_at desc);
create index idx_scraping_jobs_client_type_created on public.scraping_jobs (client_id, tipo, created_at desc);
create index idx_scraping_jobs_state_started on public.scraping_jobs (estado, started_at);
create index idx_weekly_reports_client_created on public.weekly_reports (client_id, created_at desc);

create policy "users read self" on public.users for select using (id = auth.uid());
create policy "operators read user directory" on public.users for select using (public.current_user_role() = 'operator');
create policy "users read accessible clients" on public.clients for select using (operator_id = auth.uid() or client_user_id = auth.uid());
create policy "operators create own clients" on public.clients for insert with check (public.current_user_role() = 'operator' and operator_id = auth.uid());
create policy "operators update own clients" on public.clients for update using (operator_id = auth.uid()) with check (operator_id = auth.uid());
create policy "operators delete own clients" on public.clients for delete using (operator_id = auth.uid());
create policy "users read diagnostics by access" on public.diagnostics for select using (public.can_access_client(client_id));
create policy "operators create diagnostics for own clients" on public.diagnostics for insert with check (public.current_user_role() = 'operator' and public.can_access_client(client_id));
create policy "operators update diagnostics for own clients" on public.diagnostics for update using (public.current_user_role() = 'operator' and public.can_access_client(client_id)) with check (public.can_access_client(client_id));
create policy "operators delete diagnostics for own clients" on public.diagnostics for delete using (public.current_user_role() = 'operator' and public.can_access_client(client_id));
create policy "users read score history" on public.score_history for select using (public.can_access_client(client_id));
create policy "operators create score history for own clients" on public.score_history for insert with check (public.current_user_role() = 'operator' and public.can_access_client(client_id));
create policy "operators update score history for own clients" on public.score_history for update using (public.current_user_role() = 'operator' and public.can_access_client(client_id)) with check (public.can_access_client(client_id));
create policy "operators delete score history for own clients" on public.score_history for delete using (public.current_user_role() = 'operator' and public.can_access_client(client_id));
create policy "users read actions" on public.actions for select using (public.can_access_client(client_id));
create policy "operators create actions for own clients" on public.actions for insert with check (public.current_user_role() = 'operator' and public.can_access_client(client_id));
create policy "operators update actions for own clients" on public.actions for update using (public.current_user_role() = 'operator' and public.can_access_client(client_id)) with check (public.can_access_client(client_id));
create policy "operators delete actions for own clients" on public.actions for delete using (public.current_user_role() = 'operator' and public.can_access_client(client_id));
create policy "users read files" on public.client_files for select using (public.can_access_client(client_id));
create policy "clients upload files" on public.client_files for insert with check (uploaded_by = auth.uid() and public.can_access_client(client_id));
create policy "operators manage own client files" on public.client_files for all using (public.current_user_role() = 'operator' and public.can_access_client(client_id)) with check (public.can_access_client(client_id));
create policy "users read own products" on public.products for select using (public.can_access_client(client_id));
create policy "operators manage own products" on public.products for all using (public.current_user_role() = 'operator' and public.can_access_client(client_id)) with check (public.can_access_client(client_id));
create policy "users read own margins" on public.margins for select using (public.can_access_client(client_id));
create policy "operators manage own margins" on public.margins for all using (public.current_user_role() = 'operator' and public.can_access_client(client_id)) with check (public.can_access_client(client_id));
create policy "users read own product specs" on public.product_specs for select using (public.can_access_client(client_id));
create policy "operators manage own product specs" on public.product_specs for all using (public.current_user_role() = 'operator' and public.can_access_client(client_id)) with check (public.can_access_client(client_id));
create policy "operators manage scraping jobs" on public.scraping_jobs for all using (public.current_user_role() = 'operator') with check (public.current_user_role() = 'operator');
create policy "users read notifications" on public.notifications for select using (user_id = auth.uid());
create policy "users create own notifications" on public.notifications for insert with check (user_id = auth.uid());
create policy "users update own notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own weekly reports" on public.weekly_reports for select using (public.can_access_client(client_id));
create policy "operators manage own weekly reports" on public.weekly_reports for all using (public.current_user_role() = 'operator' and public.can_access_client(client_id)) with check (public.can_access_client(client_id));

create policy "users read own client storage files"
on storage.objects for select
using (
  bucket_id = 'client-files'
  and public.can_access_client((storage.foldername(name))[1]::uuid)
);

create policy "clients upload own client storage files"
on storage.objects for insert
with check (
  bucket_id = 'client-files'
  and public.current_user_role() = 'client'
  and public.can_access_client((storage.foldername(name))[1]::uuid)
);

create policy "operators manage own client storage files"
on storage.objects for all
using (
  bucket_id = 'client-files'
  and public.current_user_role() = 'operator'
  and public.can_access_client((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'client-files'
  and public.current_user_role() = 'operator'
  and public.can_access_client((storage.foldername(name))[1]::uuid)
);

create policy "operators manage meli session files"
on storage.objects for all
using (
  bucket_id = 'meli-sessions'
  and public.current_user_role() = 'operator'
)
with check (
  bucket_id = 'meli-sessions'
  and public.current_user_role() = 'operator'
);
