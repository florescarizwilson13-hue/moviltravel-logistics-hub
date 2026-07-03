alter type transfer_request_status add value if not exists 'driver_at_pickup';
alter type transfer_request_status add value if not exists 'passenger_on_board';
alter type transfer_request_status add value if not exists 'incident';

create table if not exists travel_events (
  id uuid primary key default gen_random_uuid(),
  transfer_request_id uuid not null references transfer_requests(id) on delete cascade,
  type text not null,
  source text not null default 'whatsapp_driver',
  actor_type text not null default 'driver',
  actor_name text,
  actor_phone text,
  message_body text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now(),
  constraint travel_events_type_check check (
    type in ('driver_at_pickup', 'passenger_on_board', 'completed', 'incident')
  ),
  constraint travel_events_source_check check (source = 'whatsapp_driver'),
  constraint travel_events_actor_type_check check (actor_type = 'driver')
);

create index if not exists travel_events_transfer_request_id_idx
on travel_events(transfer_request_id);

create index if not exists travel_events_created_at_idx
on travel_events(created_at desc);

alter table travel_events enable row level security;

drop policy if exists "travel_events read active users" on travel_events;
drop policy if exists "travel_events write coordinators" on travel_events;
drop policy if exists "travel_events delete admin" on travel_events;

create policy "travel_events read active users"
on travel_events for select to authenticated
using (public.is_active_app_user());

create policy "travel_events write coordinators"
on travel_events for insert to authenticated
with check (public.is_coordinator_or_admin());

create policy "travel_events delete admin"
on travel_events for delete to authenticated
using (public.is_admin());
