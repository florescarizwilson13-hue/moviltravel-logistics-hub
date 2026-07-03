create table if not exists driver_whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  whatsapp_from text not null,
  selected_transfer_request_id uuid references transfer_requests(id) on delete set null,
  available_transfer_request_ids jsonb not null default '[]'::jsonb,
  mode text not null default 'idle',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_whatsapp_sessions_mode_check check (
    mode in ('idle', 'selecting_trip', 'trip_selected')
  ),
  constraint driver_whatsapp_sessions_whatsapp_from_not_blank check (
    length(btrim(whatsapp_from)) > 0
  )
);

create unique index if not exists driver_whatsapp_sessions_driver_from_idx
on driver_whatsapp_sessions(driver_id, whatsapp_from);

create index if not exists driver_whatsapp_sessions_selected_request_idx
on driver_whatsapp_sessions(selected_transfer_request_id);

create index if not exists driver_whatsapp_sessions_expires_at_idx
on driver_whatsapp_sessions(expires_at);

drop trigger if exists driver_whatsapp_sessions_set_updated_at on driver_whatsapp_sessions;

create trigger driver_whatsapp_sessions_set_updated_at
before update on driver_whatsapp_sessions
for each row execute function set_updated_at();

alter table driver_whatsapp_sessions enable row level security;

drop policy if exists "driver_whatsapp_sessions read active users" on driver_whatsapp_sessions;
drop policy if exists "driver_whatsapp_sessions write coordinators" on driver_whatsapp_sessions;
drop policy if exists "driver_whatsapp_sessions update coordinators" on driver_whatsapp_sessions;
drop policy if exists "driver_whatsapp_sessions delete admin" on driver_whatsapp_sessions;

create policy "driver_whatsapp_sessions read active users"
on driver_whatsapp_sessions for select to authenticated
using (public.is_active_app_user());

create policy "driver_whatsapp_sessions write coordinators"
on driver_whatsapp_sessions for insert to authenticated
with check (public.is_coordinator_or_admin());

create policy "driver_whatsapp_sessions update coordinators"
on driver_whatsapp_sessions for update to authenticated
using (public.is_coordinator_or_admin())
with check (public.is_coordinator_or_admin());

create policy "driver_whatsapp_sessions delete admin"
on driver_whatsapp_sessions for delete to authenticated
using (public.is_admin());
