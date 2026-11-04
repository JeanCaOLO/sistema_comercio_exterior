-- ============================================================
-- MIGRACIÓN: Solicitudes de cambio de campos de la orden
-- (carga lista teórica e incoterm de compra)
-- Comparte el mismo sistema de aprobación, dashboard e historial
-- que los cambios de ETD Inicial.
-- Ejecutar una sola vez en el backend conectado.
-- ============================================================

create table if not exists public.order_field_change_requests (
  id uuid primary key default gen_random_uuid(),
  change_type text not null check (change_type in ('carga_lista', 'incoterm')),
  order_number text not null,
  trading_company text not null,
  field_key text not null,
  field_label text not null,
  previous_value text,
  proposed_value text not null,
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
  api_env text not null default 'production',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_field_change_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.order_field_change_requests(id) on delete cascade,
  event_type text not null,
  detail text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz not null default now()
);

-- Una misma PO + compañía + tipo de cambio no puede tener dos pendientes.
create unique index if not exists order_field_change_pending_unique
  on public.order_field_change_requests (order_number, trading_company, change_type, api_env)
  where status = 'PENDING';

create index if not exists order_field_change_status_idx
  on public.order_field_change_requests (status);
create index if not exists order_field_change_requested_at_idx
  on public.order_field_change_requests (requested_at desc);
create index if not exists order_field_change_events_request_idx
  on public.order_field_change_events (request_id, created_at);

alter table public.order_field_change_requests enable row level security;
alter table public.order_field_change_events enable row level security;

drop policy if exists order_field_change_requests_select on public.order_field_change_requests;
create policy order_field_change_requests_select on public.order_field_change_requests
  for select to authenticated
  using (public.puede_gestionar_etd());

drop policy if exists order_field_change_requests_insert on public.order_field_change_requests;
create policy order_field_change_requests_insert on public.order_field_change_requests
  for insert to authenticated
  with check (public.puede_gestionar_etd());

drop policy if exists order_field_change_requests_update on public.order_field_change_requests;
create policy order_field_change_requests_update on public.order_field_change_requests
  for update to authenticated
  using (public.puede_gestionar_etd())
  with check (public.puede_gestionar_etd());

drop policy if exists order_field_change_events_select on public.order_field_change_events;
create policy order_field_change_events_select on public.order_field_change_events
  for select to authenticated
  using (public.puede_gestionar_etd());

drop policy if exists order_field_change_events_insert on public.order_field_change_events;
create policy order_field_change_events_insert on public.order_field_change_events
  for insert to authenticated
  with check (public.puede_gestionar_etd());