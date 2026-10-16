-- ============================================================
-- MIGRACIÓN: Módulo de Solicitud y Aprobación de Cambios ETD Inicial
-- Crea las tablas de solicitudes y su historial de auditoría (inmutable),
-- con Row Level Security para los roles que gestionan ETD.
-- Ejecutar una sola vez en el backend conectado.
-- ============================================================

-- 1) Tabla de solicitudes de cambio de ETD Inicial
create table if not exists public.etd_initial_change_requests (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  trading_company text not null,
  previous_etd_initial date,
  proposed_etd_initial date not null,
  change_reason text not null,
  other_reason_detail text,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by uuid,
  requested_by_name text,
  requested_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,
  rejection_comment text,
  api_sync_status text,
  api_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Historial inmutable de eventos y transiciones de estado
create table if not exists public.etd_initial_change_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.etd_initial_change_requests(id) on delete cascade,
  event_type text not null,
  detail text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz not null default now()
);

-- 3) Una misma PO + compañía no puede tener DOS solicitudes pendientes a la vez
create unique index if not exists etd_initial_change_requests_pending_unique
  on public.etd_initial_change_requests (order_number, trading_company)
  where status = 'PENDING';

-- 4) Índices de apoyo para filtros y ordenamientos
create index if not exists etd_requests_status_idx
  on public.etd_initial_change_requests (status);
create index if not exists etd_requests_requested_at_idx
  on public.etd_initial_change_requests (requested_at desc);
create index if not exists etd_events_request_idx
  on public.etd_initial_change_events (request_id, created_at);

-- 5) Helper: ¿el usuario autenticado pertenece a los roles que gestionan ETD?
create or replace function public.puede_gestionar_etd()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and (
        u.rol ilike '%Administrador%'
        or u.rol ilike '%Admin%'
        or u.rol ilike '%Documentos%'
      )
  );
$$;

-- 6) Row Level Security
alter table public.etd_initial_change_requests enable row level security;
alter table public.etd_initial_change_events enable row level security;

drop policy if exists etd_requests_select on public.etd_initial_change_requests;
create policy etd_requests_select on public.etd_initial_change_requests
  for select to authenticated
  using (public.puede_gestionar_etd());

drop policy if exists etd_requests_insert on public.etd_initial_change_requests;
create policy etd_requests_insert on public.etd_initial_change_requests
  for insert to authenticated
  with check (public.puede_gestionar_etd());

drop policy if exists etd_requests_update on public.etd_initial_change_requests;
create policy etd_requests_update on public.etd_initial_change_requests
  for update to authenticated
  using (public.puede_gestionar_etd())
  with check (public.puede_gestionar_etd());

drop policy if exists etd_events_select on public.etd_initial_change_events;
create policy etd_events_select on public.etd_initial_change_events
  for select to authenticated
  using (public.puede_gestionar_etd());

drop policy if exists etd_events_insert on public.etd_initial_change_events;
create policy etd_events_insert on public.etd_initial_change_events
  for insert to authenticated
  with check (public.puede_gestionar_etd());