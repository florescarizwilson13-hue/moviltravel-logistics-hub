# Supabase Setup Checklist

Project details:

- Project name: `moviltravel-logistics-hub`
- Project ref: `rxgwimwuabtibrpfgkuq`
- Project URL: `https://rxgwimwuabtibrpfgkuq.supabase.co`
- Region: South America Sao Paulo, `sa-east-1`

## Current Status

- Supabase real project is created.
- Initial migration has been applied successfully.
- Auth + roles/RLS migration has been applied successfully.
- These tables were verified in Table Editor:
  - `ai_conversations`
  - `companies`
  - `drivers`
  - `request_messages`
  - `status_history`
  - `transfer_requests`
  - `vehicles`
- Supabase Auth user `wflores@moviltravel.cl` exists.
- `wflores@moviltravel.cl` is promoted to `admin`.
- Supabase Auth is connected in the app.
- Real login works with `wflores@moviltravel.cl`.
- `/dashboard` loads after login and shows role `Admin`.
- Dashboard operational data still comes from local persistence.
- Logout remains pending for final manual verification.
- App persistence remains local with `NEXT_PUBLIC_PERSISTENCE_PROVIDER=local`.
- Do not switch to `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase` until the Supabase adapter is implemented and tested.
- Recommended next step: implement the `/drivers` adapter behind Auth as the first Supabase-backed module.

## 1. Local Environment

Create `.env.local` from `.env.example` and keep the provider in local mode:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=local
NEXT_PUBLIC_SUPABASE_URL=https://rxgwimwuabtibrpfgkuq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AI_PROVIDER=mock
```

Important:

- Do not commit `.env.local`.
- Do not paste the service role key into application code.
- Do not set `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase` yet.

## 2. Apply Schema

### Option A: SQL Editor

Use this file:

```text
supabase/migrations/0001_initial_schema.sql
```

Steps:

1. Open Supabase dashboard.
2. Select project `moviltravel-logistics-hub`.
3. Go to SQL Editor.
4. Create a new query.
5. Paste the full contents of `supabase/migrations/0001_initial_schema.sql`.
6. Run the query once.

This migration is for a clean project. If it has already run, do not run it again as-is.

### Option B: Supabase CLI

```bash
supabase login
supabase link --project-ref rxgwimwuabtibrpfgkuq
supabase db push
```

## 3. Verify Tables

In Supabase dashboard:

1. Go to Table Editor.
2. Confirm these tables exist:
   - `companies`
   - `vehicles`
   - `drivers`
   - `transfer_requests`
   - `request_messages`
   - `ai_conversations`
   - `status_history`
3. Open each table and confirm RLS is enabled.
4. Go to Database > Indexes and confirm indexes exist for:
   - `transfer_requests.status`
   - `transfer_requests.service_date`
   - `transfer_requests.assigned_driver_id`
   - `transfer_requests.company_id`
5. Go to Database > Functions and confirm:
   - `set_updated_at`
   - `record_transfer_request_status_history`

Optional SQL verification:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'companies',
    'vehicles',
    'drivers',
    'transfer_requests',
    'request_messages',
    'ai_conversations',
    'status_history'
  )
order by table_name;
```

Expected result: 7 rows.

Verify RLS:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'companies',
    'vehicles',
    'drivers',
    'transfer_requests',
    'request_messages',
    'ai_conversations',
    'status_history'
  )
order by tablename;
```

Expected result: every row has `rowsecurity = true`.

## 4. Apply Auth Roles Migration

Use this file:

```text
supabase/migrations/0002_auth_roles.sql
```

Steps:

1. Open Supabase dashboard.
2. Select project `moviltravel-logistics-hub`.
3. Go to SQL Editor.
4. Create a new query.
5. Paste the full contents of `supabase/migrations/0002_auth_roles.sql`.
6. Run the query once after `0001_initial_schema.sql` has already been applied.

This creates:

- `user_role` enum.
- `profiles` table linked to `auth.users`.
- automatic profile creation trigger.
- role helpers.
- role-based RLS policies for operational tables.

## 5. Verify Auth Roles Setup

Confirm the `profiles` table exists:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'profiles';
```

Confirm helper functions exist:

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'current_user_role',
    'is_active_app_user',
    'is_admin',
    'is_coordinator_or_admin',
    'handle_new_auth_user'
  )
order by routine_name;
```

Confirm policies are no longer deny-all:

```sql
select tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

You should see policies such as:

- `profiles select own or admin`
- `transfer_requests read active users`
- `transfer_requests write coordinators`
- `drivers write admin`
- `status_history read active users`

## 6. Create Or Promote First Admin

1. Go to Supabase Dashboard > Authentication > Users.
2. Create the first user.
3. Copy the user's UUID.
4. Run this SQL with that UUID:

```sql
update public.profiles
set role = 'admin',
    active = true,
    updated_at = now()
where id = '00000000-0000-0000-0000-000000000000';
```

New users default to `viewer` unless app metadata includes a valid role. Use SQL Editor or trusted server-side tooling for the first admin. Do not use the service role key in client code.

## 7. Verify Anonymous Access Remains Closed

After `0002_auth_roles.sql`, policies are role-based and still do not open public anonymous access. Confirm policies exist:

```sql
select tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Expected result: operational tables have policies for `authenticated` users, not broad public access. Anonymous users should not be able to read or write logistics tables.

## 8. Keep App In Local Mode

After applying the migration, run the app with:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=local
```

The app should continue using local/mock persistence. Supabase credentials can exist in `.env.local`, but they are not used for data persistence until the adapter is implemented and the provider is changed.

## 9. Safe Moment To Switch Provider

Only change to:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase
```

after all of these are complete:

- Auth is implemented in the app.
- Role-based RLS has been applied and tested for `admin`, `coordinator`, `viewer` and anonymous users.
- `src/lib/repositories/supabase` is fully implemented.
- The repository/hook layer supports async Supabase calls.
- `/drivers`, `/requests`, `/requests/[id]`, `/dashboard` and `/ai-capture` pass manual testing against Supabase.
- No browser code imports or exposes `SUPABASE_SERVICE_ROLE_KEY`.
