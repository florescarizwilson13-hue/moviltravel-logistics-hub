# Database

Moviltravel Logistics Hub must use a new independent Supabase project. The schema in
`supabase/migrations/0001_initial_schema.sql` does not reference previous Moviltravel systems.

Real project prepared for this app:

- Project name: `moviltravel-logistics-hub`
- Project ref: `rxgwimwuabtibrpfgkuq`
- Project URL: `https://rxgwimwuabtibrpfgkuq.supabase.co`
- Region: South America Sao Paulo, `sa-east-1`

## Current Status

- Supabase real project is created.
- Initial migration `supabase/migrations/0001_initial_schema.sql` has been applied successfully.
- Auth + roles/RLS migration `supabase/migrations/0002_auth_roles.sql` has been applied successfully.
- Tables verified in Supabase Table Editor:
  - `ai_conversations`
  - `companies`
  - `drivers`
  - `request_messages`
  - `status_history`
  - `transfer_requests`
  - `vehicles`
- Supabase Auth user `wflores@moviltravel.cl` has been created.
- `wflores@moviltravel.cl` has been promoted to `admin` through SQL.
- The app still runs with `NEXT_PUBLIC_PERSISTENCE_PROVIDER=local`.
- It is not safe to switch to `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase` yet. App login and the Supabase repository adapter are still pending.
- Recommended next step: implement Supabase login in the app while keeping persistence local, then implement the Supabase adapter starting with `/drivers`.

## Main Tables

- `companies`: companies or customers related to transfer requests.
- `transfer_requests`: transfer service requests. Operational fields are nullable so requests can exist while incomplete.
- `drivers`: driver registry and current local assignment data.
- `vehicles`: vehicle registry for the real fleet model.
- `request_messages`: generated WhatsApp messages. Messages are stored but not sent.
- `ai_conversations`: progressive AI capture sessions and extracted data history.
- `status_history`: automatic timeline of transfer request status changes.

## Auth Tables

- `profiles`: application profile for each Supabase Auth user, linked by `profiles.id = auth.users.id`.

## Design Decisions

### Incomplete Requests

`transfer_requests` allows nullable company, requester, passenger, route and schedule fields. Completeness is decided by application logic in `src/modules/transfer-requests`, not by SQL `not null` constraints.

The database only enforces basic integrity:

- `passenger_count` must be positive when present.
- assigned/confirmed/in-progress/completed requests must have `assigned_driver_id`.
- status values are constrained by the `transfer_request_status` enum.

### Drivers And Vehicles

`vehicles` is kept as a first-class table because a real logistics MVP will need fleet management, availability, maintenance and reporting.

`drivers` also keeps `vehicle_name`, `vehicle_plate` and `vehicle_capacity` as nullable snapshot/manual fields. This preserves compatibility with the current local driver flow while the real vehicle module is still incomplete.

When Supabase is connected:

1. Use `drivers.current_vehicle_id` for structured fleet assignment when a vehicle exists.
2. Keep the embedded driver vehicle fields as a display snapshot or fallback.
3. Use `transfer_requests.assigned_vehicle_id` when the assignment chooses a real vehicle.

### AI Progressive Capture

`ai_conversations` stores:

- `provider`, currently `mock`, later `openai` or another provider.
- `captured_data` as JSON.
- `missing_fields` as text array.
- `messages` as JSON conversation history.
- optional `confidence`.

This lets the coordinator create an incomplete request and progressively complete it with later WhatsApp messages.

### Messages

`request_messages` stores generated WhatsApp-ready messages with status `generated`. The schema allows future statuses such as `queued`, `sent` and `failed`, but the current app must not send WhatsApp messages.

### Status History

The migration creates a trigger that inserts into `status_history` when a request is created and whenever `transfer_requests.status` changes.

`status_history.changed_by` references `auth.users(id)` and may be `null` for system/service changes.

## Dashboard Indexes

The migration adds indexes for common dashboard and operational queries:

- `transfer_requests.status`
- `transfer_requests.service_date`
- `transfer_requests.assigned_driver_id`
- `transfer_requests.company_id`
- `transfer_requests(status, service_date)`
- generated messages by `created_at`
- active drivers by `availability`
- status timeline by request and `created_at`

`service_date` is a generated column from `pickup_date` so dashboard queries can use the expected operational name without losing compatibility with the app's current `pickupDate` field.

## Row Level Security

RLS is enabled on every table.

The initial migration creates explicit deny-all policies for `public`. This is intentional:

- anonymous/public clients cannot read or write logistics data.
- app access policies must be added after authentication and coordinator roles are defined.
- Supabase service role can still be used from trusted server-side code or migrations.

`supabase/migrations/0002_auth_roles.sql` prepares the Auth role model:

- `profiles` linked to `auth.users`.
- `user_role` enum: `admin`, `coordinator`, `viewer`.
- automatic profile creation when a Supabase Auth user is created.
- helper functions:
  - `current_user_role()`
  - `is_active_app_user()`
  - `is_admin()`
  - `is_coordinator_or_admin()`
- role-based RLS policies replacing the initial deny-all policies.

Role summary:

- `admin`: read/write configuration tables, manage drivers/vehicles, manage profiles, delete operational records when needed.
- `coordinator`: create/edit requests, assign drivers, create/update generated messages and AI conversations.
- `viewer`: read-only access to operational tables.

Still pending before provider switch:

- connect UI login to Supabase Auth.
- implement the Supabase repository adapter.
- decide whether drivers ever get their own restricted access.
- keep WhatsApp sending, if added later, behind server-side service-role code.

## Environment Variables

Local/mock mode:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=local
NEXT_PUBLIC_SUPABASE_URL=https://rxgwimwuabtibrpfgkuq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Future Supabase mode:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Server-only variables for future trusted operations:

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Applying The Migration

Using Supabase CLI:

```bash
supabase login
supabase link --project-ref rxgwimwuabtibrpfgkuq
supabase db push
```

Or apply the SQL manually:

1. Open the Supabase dashboard for `moviltravel-logistics-hub`.
2. Go to SQL Editor.
3. Paste the full contents of `supabase/migrations/0001_initial_schema.sql`.
4. Run the script.
5. Confirm that all tables have RLS enabled.

The migration is intended for a clean project. If it has already been applied, do not paste it again without converting repeated `create type`, `create table`, `create trigger` and `create policy` statements into incremental migrations.

## Applying Auth And Roles Migration

After `0001_initial_schema.sql` is applied, run:

```text
supabase/migrations/0002_auth_roles.sql
```

You can apply it through SQL Editor or Supabase CLI:

```bash
supabase db push
```

This migration does not connect the app UI to login and does not change `NEXT_PUBLIC_PERSISTENCE_PROVIDER`.

## Creating The First Admin

1. Create the user in Supabase Dashboard > Authentication > Users.
2. Copy the new user's `id`.
3. Run this in SQL Editor, replacing the UUID:

```sql
update public.profiles
set role = 'admin',
    active = true,
    updated_at = now()
where id = '00000000-0000-0000-0000-000000000000';
```

The automatic trigger creates new profiles as `viewer` unless Auth app metadata contains a valid role. The first admin must be promoted from SQL Editor or another trusted server-side path.

## First Tables To Connect

Recommended connection order:

1. `transfer_requests`: create, update, mark ready and assign.
2. `drivers`: list active drivers, create/edit/activate/deactivate.
3. `request_messages`: persist generated WhatsApp messages.
4. `dashboard` queries: aggregate requests, messages and active drivers.
5. `ai_conversations`: store progressive AI capture history.
6. `vehicles`: move from embedded driver vehicle fields into real fleet assignments.

## Local-To-Supabase Replacement

The current UI uses repository interfaces in `src/lib/repositories/types.ts`.

To connect Supabase:

1. Keep Supabase client setup inside `src/lib/supabase`.
2. Implement `src/lib/repositories/supabase`.
3. Map snake_case database rows to camelCase domain types at the repository boundary.
4. Set `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase`.
5. Keep business logic in `src/modules`.
