create extension if not exists pgcrypto;

create type transfer_request_status as enum (
  'draft',
  'incomplete',
  'pending_review',
  'ready_to_assign',
  'assigned',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled'
);

create type driver_availability as enum ('available', 'busy', 'inactive');
create type vehicle_status as enum ('available', 'assigned', 'maintenance', 'inactive');
create type message_channel as enum ('whatsapp');
create type message_status as enum ('draft', 'generated', 'queued', 'sent', 'failed');
create type message_template as enum ('request_summary', 'driver_assignment', 'missing_information');
create type ai_conversation_status as enum ('open', 'completed', 'cancelled');

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  contact_name text,
  contact_phone text,
  contact_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_name_not_blank check (length(btrim(name)) > 0)
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  brand text,
  model text,
  year integer,
  capacity integer,
  status vehicle_status not null default 'available',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_plate_not_blank check (length(btrim(plate)) > 0),
  constraint vehicles_capacity_positive check (capacity is null or capacity > 0),
  constraint vehicles_year_reasonable check (year is null or year between 1980 and 2100)
);

create table drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  license_number text,
  current_vehicle_id uuid references vehicles(id) on delete set null,
  vehicle_name text,
  vehicle_plate text,
  vehicle_capacity integer,
  availability driver_availability not null default 'available',
  is_seed boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drivers_full_name_not_blank check (length(btrim(full_name)) > 0),
  constraint drivers_vehicle_capacity_positive check (vehicle_capacity is null or vehicle_capacity > 0)
);

create table transfer_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  company_name text,
  requester_name text,
  requester_phone text,
  requester_email text,
  passenger_name text,
  passenger_phone text,
  origin_address text,
  destination_address text,
  pickup_date date,
  service_date date generated always as (pickup_date) stored,
  pickup_time time,
  pickup_at timestamptz,
  passenger_count integer,
  cargo_description text,
  special_requirements text,
  notes text,
  assigned_driver_id uuid references drivers(id) on delete set null,
  assigned_vehicle_id uuid references vehicles(id) on delete set null,
  status transfer_request_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfer_requests_passenger_count_positive check (
    passenger_count is null or passenger_count > 0
  ),
  constraint transfer_requests_assigned_driver_required check (
    status not in ('assigned', 'confirmed', 'in_progress', 'completed')
    or assigned_driver_id is not null
  )
);

create table request_messages (
  id uuid primary key default gen_random_uuid(),
  transfer_request_id uuid not null references transfer_requests(id) on delete cascade,
  channel message_channel not null default 'whatsapp',
  template message_template not null,
  recipient_name text,
  recipient_phone text,
  body text not null,
  status message_status not null default 'generated',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_messages_body_not_blank check (length(btrim(body)) > 0)
);

create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  transfer_request_id uuid references transfer_requests(id) on delete set null,
  provider text not null default 'mock',
  status ai_conversation_status not null default 'open',
  source_channel text,
  source_reference text,
  confidence numeric(4, 3),
  captured_data jsonb not null default '{}'::jsonb,
  missing_fields text[] not null default '{}'::text[],
  messages jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_conversations_provider_not_blank check (length(btrim(provider)) > 0),
  constraint ai_conversations_confidence_range check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create table status_history (
  id uuid primary key default gen_random_uuid(),
  transfer_request_id uuid not null references transfer_requests(id) on delete cascade,
  from_status transfer_request_status,
  to_status transfer_request_status not null,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint status_history_status_changed check (
    from_status is null or from_status <> to_status
  )
);

create index companies_name_idx on companies using btree (name);

create index vehicles_status_idx on vehicles(status);
create index vehicles_plate_idx on vehicles(plate);

create index drivers_availability_idx on drivers(availability);
create index drivers_current_vehicle_id_idx on drivers(current_vehicle_id);

create index transfer_requests_status_idx on transfer_requests(status);
create index transfer_requests_service_date_idx on transfer_requests(service_date);
create index transfer_requests_assigned_driver_id_idx on transfer_requests(assigned_driver_id);
create index transfer_requests_company_id_idx on transfer_requests(company_id);
create index transfer_requests_status_service_date_idx on transfer_requests(status, service_date);
create index transfer_requests_created_at_idx on transfer_requests(created_at desc);

create index request_messages_transfer_request_id_idx on request_messages(transfer_request_id);
create index request_messages_status_idx on request_messages(status);
create index request_messages_created_at_idx on request_messages(created_at desc);

create index ai_conversations_transfer_request_id_idx on ai_conversations(transfer_request_id);
create index ai_conversations_status_idx on ai_conversations(status);

create index status_history_transfer_request_id_idx on status_history(transfer_request_id);
create index status_history_created_at_idx on status_history(created_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function record_transfer_request_status_history()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into status_history (transfer_request_id, from_status, to_status, reason, changed_by)
    values (new.id, null, new.status, 'created', auth.uid());
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into status_history (transfer_request_id, from_status, to_status, reason, changed_by)
    values (new.id, old.status, new.status, 'status_changed', auth.uid());
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

create trigger companies_set_updated_at
before update on companies
for each row execute function set_updated_at();

create trigger vehicles_set_updated_at
before update on vehicles
for each row execute function set_updated_at();

create trigger drivers_set_updated_at
before update on drivers
for each row execute function set_updated_at();

create trigger transfer_requests_set_updated_at
before update on transfer_requests
for each row execute function set_updated_at();

create trigger request_messages_set_updated_at
before update on request_messages
for each row execute function set_updated_at();

create trigger ai_conversations_set_updated_at
before update on ai_conversations
for each row execute function set_updated_at();

create trigger transfer_requests_record_initial_status
after insert on transfer_requests
for each row execute function record_transfer_request_status_history();

create trigger transfer_requests_record_status_change
after update of status on transfer_requests
for each row execute function record_transfer_request_status_history();

alter table companies enable row level security;
alter table vehicles enable row level security;
alter table drivers enable row level security;
alter table transfer_requests enable row level security;
alter table request_messages enable row level security;
alter table ai_conversations enable row level security;
alter table status_history enable row level security;

create policy "deny public access until auth model is configured"
on companies for all to public
using (false)
with check (false);

create policy "deny public access until auth model is configured"
on vehicles for all to public
using (false)
with check (false);

create policy "deny public access until auth model is configured"
on drivers for all to public
using (false)
with check (false);

create policy "deny public access until auth model is configured"
on transfer_requests for all to public
using (false)
with check (false);

create policy "deny public access until auth model is configured"
on request_messages for all to public
using (false)
with check (false);

create policy "deny public access until auth model is configured"
on ai_conversations for all to public
using (false)
with check (false);

create policy "deny public access until auth model is configured"
on status_history for all to public
using (false)
with check (false);
