create table if not exists communication_events (
  id uuid primary key default gen_random_uuid(),
  transfer_request_id uuid not null references transfer_requests(id) on delete cascade,
  type text not null,
  channel text not null default 'whatsapp',
  recipient_type text not null,
  recipient_name text,
  recipient_phone text,
  message_body text,
  created_by text,
  created_at timestamptz not null default now(),
  constraint communication_events_type_check check (
    type in (
      'whatsapp_passenger_copied',
      'whatsapp_driver_copied',
      'whatsapp_passenger_marked_sent',
      'whatsapp_driver_marked_sent'
    )
  ),
  constraint communication_events_channel_check check (channel = 'whatsapp'),
  constraint communication_events_recipient_type_check check (
    recipient_type in ('passenger', 'driver')
  )
);

create index if not exists communication_events_transfer_request_id_idx
on communication_events(transfer_request_id);

create index if not exists communication_events_created_at_idx
on communication_events(created_at desc);

alter table communication_events enable row level security;

drop policy if exists "communication_events read active users" on communication_events;
drop policy if exists "communication_events write coordinators" on communication_events;
drop policy if exists "communication_events delete admin" on communication_events;

create policy "communication_events read active users"
on communication_events for select to authenticated
using (public.is_active_app_user());

create policy "communication_events write coordinators"
on communication_events for insert to authenticated
with check (public.is_coordinator_or_admin());

create policy "communication_events delete admin"
on communication_events for delete to authenticated
using (public.is_admin());
