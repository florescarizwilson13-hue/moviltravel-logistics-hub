do $$
begin
  create type user_role as enum ('admin', 'coordinator', 'viewer');
exception
  when duplicate_object then null;
end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on profiles;

create trigger profiles_set_updated_at
before update on profiles
for each row execute function set_updated_at();

create index if not exists profiles_role_idx on profiles(role);
create index if not exists profiles_active_idx on profiles(active);

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.active is true
  limit 1
$$;

create or replace function public.is_active_app_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_user_role() is not null
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_user_role() = 'admin'::user_role
$$;

create or replace function public.is_coordinator_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_user_role() in ('admin'::user_role, 'coordinator'::user_role)
$$;

grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_active_app_user() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_coordinator_or_admin() to anon, authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requested_role text;
  profile_role user_role;
begin
  requested_role := new.raw_app_meta_data ->> 'role';
  profile_role := case
    when requested_role in ('admin', 'coordinator', 'viewer') then requested_role::user_role
    else 'viewer'::user_role
  end;

  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      new.email
    ),
    profile_role,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists auth_users_create_profile on auth.users;

create trigger auth_users_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, full_name, role, active)
select
  users.id,
  coalesce(
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    nullif(users.raw_user_meta_data ->> 'name', ''),
    users.email
  ),
  case
    when users.raw_app_meta_data ->> 'role' in ('admin', 'coordinator', 'viewer')
      then (users.raw_app_meta_data ->> 'role')::user_role
    else 'viewer'::user_role
  end,
  true
from auth.users
on conflict (id) do nothing;

alter table profiles enable row level security;

drop policy if exists "profiles select own or admin" on profiles;
drop policy if exists "profiles insert admin" on profiles;
drop policy if exists "profiles update admin" on profiles;
drop policy if exists "profiles delete admin" on profiles;

create policy "profiles select own or admin"
on profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "profiles insert admin"
on profiles for insert to authenticated
with check (public.is_admin());

create policy "profiles update admin"
on profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "profiles delete admin"
on profiles for delete to authenticated
using (public.is_admin());

drop policy if exists "deny public access until auth model is configured" on companies;
drop policy if exists "deny public access until auth model is configured" on vehicles;
drop policy if exists "deny public access until auth model is configured" on drivers;
drop policy if exists "deny public access until auth model is configured" on transfer_requests;
drop policy if exists "deny public access until auth model is configured" on request_messages;
drop policy if exists "deny public access until auth model is configured" on ai_conversations;
drop policy if exists "deny public access until auth model is configured" on status_history;

drop policy if exists "companies read active users" on companies;
drop policy if exists "companies write admin" on companies;

create policy "companies read active users"
on companies for select to authenticated
using (public.is_active_app_user());

create policy "companies write admin"
on companies for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "vehicles read active users" on vehicles;
drop policy if exists "vehicles write admin" on vehicles;

create policy "vehicles read active users"
on vehicles for select to authenticated
using (public.is_active_app_user());

create policy "vehicles write admin"
on vehicles for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "drivers read active users" on drivers;
drop policy if exists "drivers write admin" on drivers;

create policy "drivers read active users"
on drivers for select to authenticated
using (public.is_active_app_user());

create policy "drivers write admin"
on drivers for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "transfer_requests read active users" on transfer_requests;
drop policy if exists "transfer_requests write coordinators" on transfer_requests;
drop policy if exists "transfer_requests update coordinators" on transfer_requests;
drop policy if exists "transfer_requests delete admin" on transfer_requests;

create policy "transfer_requests read active users"
on transfer_requests for select to authenticated
using (public.is_active_app_user());

create policy "transfer_requests write coordinators"
on transfer_requests for insert to authenticated
with check (public.is_coordinator_or_admin());

create policy "transfer_requests update coordinators"
on transfer_requests for update to authenticated
using (public.is_coordinator_or_admin())
with check (public.is_coordinator_or_admin());

create policy "transfer_requests delete admin"
on transfer_requests for delete to authenticated
using (public.is_admin());

drop policy if exists "request_messages read active users" on request_messages;
drop policy if exists "request_messages write coordinators" on request_messages;
drop policy if exists "request_messages update coordinators" on request_messages;
drop policy if exists "request_messages delete admin" on request_messages;

create policy "request_messages read active users"
on request_messages for select to authenticated
using (public.is_active_app_user());

create policy "request_messages write coordinators"
on request_messages for insert to authenticated
with check (public.is_coordinator_or_admin());

create policy "request_messages update coordinators"
on request_messages for update to authenticated
using (public.is_coordinator_or_admin())
with check (public.is_coordinator_or_admin());

create policy "request_messages delete admin"
on request_messages for delete to authenticated
using (public.is_admin());

drop policy if exists "ai_conversations read active users" on ai_conversations;
drop policy if exists "ai_conversations write coordinators" on ai_conversations;
drop policy if exists "ai_conversations update coordinators" on ai_conversations;
drop policy if exists "ai_conversations delete admin" on ai_conversations;

create policy "ai_conversations read active users"
on ai_conversations for select to authenticated
using (public.is_active_app_user());

create policy "ai_conversations write coordinators"
on ai_conversations for insert to authenticated
with check (public.is_coordinator_or_admin());

create policy "ai_conversations update coordinators"
on ai_conversations for update to authenticated
using (public.is_coordinator_or_admin())
with check (public.is_coordinator_or_admin());

create policy "ai_conversations delete admin"
on ai_conversations for delete to authenticated
using (public.is_admin());

drop policy if exists "status_history read active users" on status_history;

create policy "status_history read active users"
on status_history for select to authenticated
using (public.is_active_app_user());
