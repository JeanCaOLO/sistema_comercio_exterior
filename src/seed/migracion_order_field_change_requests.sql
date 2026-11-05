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

-- ============================================================
-- Permiso para SOLICITAR cambios de campos (carga lista / incoterm).
-- Se resuelve contra la Matriz de Permisos guardada en
-- configuracion_sistema: alcanza con que alguno de los roles del
-- usuario tenga asignado el módulo 'carga-lista-solicitar'.
-- De esta forma, cualquier rol al que el administrador le habilite
-- el módulo puede crear solicitudes, no solo Documentos.
-- ============================================================
create or replace function public.puede_solicitar_cambio_campo()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  with yo as (
    select u.id, u.rol
    from public.usuarios u
    where u.id = auth.uid()
       or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    limit 1
  ),
  roles_usuario as (
    select distinct lower(trim(r.nombre)) as rol
    from yo
    join public.usuario_roles ur on ur.usuario_id = yo.id
    join public.roles r on r.id = ur.rol_id
    union
    select lower(trim(replace(x, '_', ' ')))
    from yo, unnest(string_to_array(coalesce(yo.rol, ''), ',')) as x
  ),
  matriz as (
    select valor::jsonb as m
    from public.configuracion_sistema
    where clave = 'matriz_permisos'
    limit 1
  )
  select exists (
    select 1
    from roles_usuario ru
    where ru.rol <> ''
      and (
        ru.rol = 'administrador'
        or ru.rol like 'administrador%'
        or exists (
          select 1
          from matriz,
               jsonb_each(matriz.m) as e(clave, modulos)
          where lower(trim(replace(e.clave, '_', ' '))) = ru.rol
            and jsonb_typeof(e.modulos) = 'array'
            and e.modulos ? 'carga-lista-solicitar'
        )
        or (
          not exists (select 1 from matriz)
          and ru.rol in ('documentos', 'expedientes')
        )
      )
  );
$function$;

drop policy if exists order_field_change_requests_select on public.order_field_change_requests;
create policy order_field_change_requests_select on public.order_field_change_requests
  for select to authenticated
  using (public.puede_gestionar_etd() or public.puede_solicitar_cambio_campo());

drop policy if exists order_field_change_requests_insert on public.order_field_change_requests;
create policy order_field_change_requests_insert on public.order_field_change_requests
  for insert to authenticated
  with check (public.puede_solicitar_cambio_campo());

drop policy if exists order_field_change_requests_update on public.order_field_change_requests;
create policy order_field_change_requests_update on public.order_field_change_requests
  for update to authenticated
  using (public.puede_gestionar_etd())
  with check (public.puede_gestionar_etd());

drop policy if exists order_field_change_events_select on public.order_field_change_events;
create policy order_field_change_events_select on public.order_field_change_events
  for select to authenticated
  using (public.puede_gestionar_etd() or public.puede_solicitar_cambio_campo());

drop policy if exists order_field_change_events_insert on public.order_field_change_events;
create policy order_field_change_events_insert on public.order_field_change_events
  for insert to authenticated
  with check (
    public.puede_gestionar_etd()
    or (
      public.puede_solicitar_cambio_campo()
      and exists (
        select 1
        from public.order_field_change_requests r
        where r.id = order_field_change_events.request_id
          and (
            r.requested_by = auth.uid()
            or lower(coalesce(r.requested_by_name, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
      )
    )
  );