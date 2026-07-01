# Supabase Connection Plan

This plan describes how to connect Moviltravel Logistics Hub to a real, independent Supabase project without breaking the current local MVP.

For the initial real-project setup, use `docs/supabase-setup-checklist.md`.

## Current Supabase Status

- Real Supabase project is created:
  - Project name: `moviltravel-logistics-hub`
  - Project ref: `rxgwimwuabtibrpfgkuq`
  - Project URL: `https://rxgwimwuabtibrpfgkuq.supabase.co`
  - Region: South America Sao Paulo, `sa-east-1`
- Initial migration has been applied successfully.
- Auth + roles/RLS migration has been applied successfully.
- Verified tables:
  - `ai_conversations`
  - `companies`
  - `drivers`
  - `request_messages`
  - `status_history`
  - `transfer_requests`
  - `vehicles`
- Supabase Auth user `wflores@moviltravel.cl` exists and is promoted to `admin`.
- Supabase Auth is connected in the app and real login was tested successfully with `wflores@moviltravel.cl`.
- `/dashboard` loads after login and shows the authenticated user with role `Admin`.
- Operational data still uses local persistence.
- Logout remains pending for final manual verification.
- The application is still intentionally running with `NEXT_PUBLIC_PERSISTENCE_PROVIDER=local`.
- It is not safe to switch the provider to `supabase` until the Supabase repository adapter is implemented and tested.
- `/drivers` Supabase adapter is implemented; testing notes live in `docs/supabase-drivers-adapter.md`.
- `/requests`, `/requests/new` and `/requests/[id]` Supabase adapter is implemented for `public.transfer_requests`; testing notes live in `docs/supabase-transfer-requests-adapter.md`.
- Generated assignment messages still remain local until `request_messages` repository is connected.

## 1. Transition Strategy

### Principles

- Keep `NEXT_PUBLIC_PERSISTENCE_PROVIDER=local` as the default until Supabase is verified end to end.
- Keep business rules in `src/modules`.
- Keep Supabase access isolated in `src/lib/supabase` and `src/lib/repositories/supabase`.
- Keep the local adapter available as a fallback during rollout.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.

### Modules To Connect First

1. `drivers`
   - Lowest operational risk.
   - Small CRUD surface.
   - Lets assignment use real active drivers before request migration.
2. `transfer_requests`
   - Core MVP data.
   - Requires careful status, completeness and assignment behavior.
3. `request_messages`
   - Needed after assignment so generated WhatsApp messages persist.
   - Still no real WhatsApp sending.
4. `dashboard`
   - Can be rebuilt from Supabase queries once requests, drivers and messages are connected.
5. `ai_conversations`
   - Useful, but not required to operate the initial request flow.
6. `vehicles`
   - Keep partially local/manual at first through embedded driver vehicle fields.
   - Move to structured vehicle assignment after the MVP request flow is stable.

### Modules To Keep Local Temporarily

- `ai-capture` parsing/provider logic remains mock/local until OpenAI is selected.
- `vehicles` UI can remain placeholder/manual while drivers keep `vehicle_name`, `vehicle_plate` and `vehicle_capacity`.
- Any local demo/seed behavior remains available only when `NEXT_PUBLIC_PERSISTENCE_PROVIDER=local`.

### Avoiding Breakage

- Implement Supabase adapter behind the existing repository factory.
- Add integration checks route by route before flipping the provider:
  - `/drivers`
  - `/requests`
  - `/requests/[id]`
  - `/dashboard`
  - `/ai-capture`
- Keep the local repository untouched while the Supabase repository is built.
- Use feature-branch testing with a clean Supabase project and RLS enabled.
- Only change `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase` after auth, RLS and the first connected repository pass acceptance checks.

### Provider Switch

Local mode:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=local
```

Supabase mode:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Server-only:

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The service role key must only be used in trusted server-side code, migrations, background jobs or scripts.

## 2. Auth And Roles

Use Supabase Auth with a `profiles` table linked to `auth.users`. The prepared migration `supabase/migrations/0002_auth_roles.sql` creates profiles automatically when users are created.

Minimum roles:

- `admin`: full operational and configuration access.
- `coordinator`: daily operations for requests, assignments and generated messages.
- `viewer`: read-only operational visibility.

### Permissions

`admin`

- View all requests.
- Create/edit requests.
- Mark requests ready.
- Assign drivers.
- Manage drivers and vehicles.
- View generated messages and AI conversations.
- Administer configuration and user roles.

`coordinator`

- View all requests.
- Create/edit requests.
- Mark requests ready.
- Assign drivers.
- Create/generated request messages through assignment.
- View drivers, vehicles, messages and status history.
- Cannot manage app configuration or user roles.

`viewer`

- View requests, drivers, vehicles, messages and status history.
- Cannot create/edit requests.
- Cannot assign drivers.
- Cannot manage drivers, vehicles, configuration or users.

## 3. RLS Policy Proposal

The initial migration intentionally denies public access. `supabase/migrations/0002_auth_roles.sql` replaces those deny-all policies with role-based policies for authenticated users.

Recommended helper function:

```sql
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
```

Recommended role helpers:

```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_role() = 'admin'::user_role
$$;

create or replace function public.is_coordinator_or_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_role() in ('admin'::user_role, 'coordinator'::user_role)
$$;

create or replace function public.is_authenticated_app_user()
returns boolean
language sql
stable
as $$
  select public.current_user_role() is not null
$$;
```

### companies

- `select`: authenticated `admin`, `coordinator`, `viewer`.
- `insert/update/delete`: `admin`.
- Optional later: allow `coordinator` to create company names during intake, but this should wait until duplicate-company handling is defined.

### transfer_requests

- `select`: authenticated `admin`, `coordinator`, `viewer`.
- `insert`: `admin`, `coordinator`.
- `update`: `admin`, `coordinator`.
- `delete`: `admin` only, or avoid deletes and use `cancelled`.

### drivers

- `select`: authenticated `admin`, `coordinator`, `viewer`.
- `insert/update`: `admin` initially. Consider `coordinator` after operational governance is clear.
- `delete`: `admin` only, preferably soft-deactivate instead of delete.

### vehicles

- `select`: authenticated `admin`, `coordinator`, `viewer`.
- `insert/update/delete`: `admin` initially.
- `coordinator` can use vehicles for assignment through `transfer_requests.assigned_vehicle_id`, but not edit fleet records.

### request_messages

- `select`: authenticated `admin`, `coordinator`, `viewer`.
- `insert`: `admin`, `coordinator` only for generated messages.
- `update`: `admin`, `coordinator` for future status transitions like `queued`, `sent`, `failed`.
- `delete`: `admin` only.

### ai_conversations

- `select`: authenticated `admin`, `coordinator`, `viewer`.
- `insert/update`: `admin`, `coordinator`.
- `delete`: `admin` only.
- If provider payloads later contain sensitive raw content, consider hiding this table from `viewer`.

### status_history

- `select`: authenticated `admin`, `coordinator`, `viewer`.
- `insert`: normally handled by trigger, not direct client inserts.
- `update/delete`: no client role by default. `admin` only if manual audit correction is explicitly needed.

## 4. Supabase Adapter Design

The current repository interfaces are synchronous because the local adapter reads browser `localStorage`. Supabase calls are asynchronous, so the implementation should first introduce an async-friendly repository contract or a data-loading hook that hides async behavior from visual components.

Recommended approach:

1. Add async repository methods while keeping local implementations wrapped in `Promise.resolve`.
2. Update the shared store hook to support loading, saving, error and refreshing states.
3. Keep React components calling repository methods, not Supabase directly.

### transferRequests repository

Responsibilities:

- Load requests for list/detail/dashboard snapshots.
- Create incomplete or complete requests.
- Update request fields without overwriting valid existing data unless explicitly edited.
- Mark `pending_review` as `ready_to_assign`.
- Assign driver and optional vehicle.
- Generate request messages during assignment.
- Let SQL trigger write `status_history`.

Implementation notes:

- Map camelCase domain fields to snake_case SQL columns.
- Use module functions for status decisions before writing.
- Use a transaction-like RPC for assignment plus message creation if consistency becomes important.
- Prefer `cancelled` over physical delete.

### drivers repository

Responsibilities:

- List drivers.
- Create driver.
- Update driver.
- Set active/inactive via `availability`.
- Filter active drivers for assignment.

Implementation notes:

- Keep embedded vehicle fields during first Supabase phase.
- Later add structured `current_vehicle_id` flows.

### messages repository

Responsibilities:

- List messages by request.
- List latest generated messages.
- Persist generated WhatsApp message records.

Implementation notes:

- Store generated messages only.
- Do not send WhatsApp from the repository.
- Future sending should be server-side and should update `status`.

### dashboard repository

Responsibilities:

- Return metrics for open requests, incomplete, pending review, ready to assign, assigned, generated messages and active drivers.
- Return attention-required requests.
- Return latest generated messages.
- Return active drivers.

Implementation notes:

- First version can load the required rows and reuse `src/modules/dashboard`.
- Later optimize with SQL views or RPC functions if data volume grows.

### ai conversations repository

Responsibilities:

- Save capture sessions and follow-up messages.
- Link conversations to `transfer_requests`.
- Store `captured_data`, `missing_fields`, `messages`, `confidence` and provider.

Implementation notes:

- Keep provider `mock` until OpenAI is connected.
- Do not store secrets or API keys in conversation payloads.

## 5. Recommended Implementation Order

1. Auth baseline
   - Configure Supabase Auth.
   - Decide where role lives.
   - Add role helper SQL functions.
   - Replace deny-all RLS with role-based policies.
2. Supabase client boundary
   - Verify `src/lib/supabase` browser/server clients.
   - Confirm env loading.
   - Add authenticated session handling in Next.js.
3. Drivers Supabase
   - Implement `drivers` repository.
   - Test `/drivers`.
   - Confirm active drivers appear in assignment.
4. Transfer requests Supabase
   - Implement create/update/list/detail/mark ready.
   - Test incomplete and complete request flows.
5. Assignment and messages
   - Implement assignment persistence.
   - Persist generated WhatsApp messages.
   - Confirm no real WhatsApp send exists.
6. Dashboard Supabase
   - Implement dashboard queries.
   - Compare local and Supabase metrics with equivalent seed data.
7. AI conversations
   - Save capture sessions.
   - Link created/updated requests.
   - Keep mock provider active.
8. Vehicles
   - Add real vehicle management.
   - Move assignment from embedded driver vehicle fields to structured vehicle references.
9. Provider switch
   - Set `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase`.
   - Run full acceptance checklist.
   - Keep local mode documented for demos and fallback.

## 6. Risks

### localStorage Migration

Local data exists only in the browser. Decide whether to discard, export/import manually, or build a one-time migration tool. Avoid automatic silent sync because it can create duplicates.

### Duplicate Data

Companies, drivers and transfer requests can be created locally and in Supabase with similar labels. Before migration, define deduplication rules:

- company by normalized name and tax ID when available.
- driver by phone or license number when available.
- request by created date, passenger, origin, destination and pickup time.

### RLS Blocking Operations

RLS failures can look like empty data or generic permission errors. Test every repository method with each role:

- admin
- coordinator
- viewer
- anonymous

### Service Role In Client

Never use `SUPABASE_SERVICE_ROLE_KEY` in browser code, `.env.local` values exposed with `NEXT_PUBLIC_`, client bundles, or repository methods called from client components.

### Schema Changes

Changing enums or generated columns after data exists requires migration care. Add new enum values with `alter type ... add value`; avoid dropping status values.

### Auth Not Defined

The current migration is secure by denying public access. The app will not work in Supabase mode until Auth roles and RLS policies are implemented.

### Async Repository Shift

Supabase requires async calls. The current local repository shape is mostly sync. Plan a small repository/hook refactor before real adapter work.

## 7. Acceptance Criteria

Supabase is correctly connected when all of these are true:

- Anonymous users cannot read or write any logistics table.
- Authenticated `viewer` can read operational data but cannot mutate it.
- Authenticated `coordinator` can create/edit requests, mark ready, assign drivers and generate message records.
- Authenticated `coordinator` cannot manage roles or app configuration.
- Authenticated `admin` can manage drivers, vehicles and configuration.
- `/drivers` lists Supabase drivers and can create/edit/activate/deactivate according to role.
- `/requests` lists Supabase requests and preserves incomplete-request behavior.
- `/requests/new` creates incomplete or complete requests.
- `/requests/[id]` can complete data, mark ready, assign driver and show generated messages.
- `/dashboard` metrics match database state.
- `/ai-capture` can create/update requests while keeping provider `mock`.
- `request_messages` records are created with `generated` status and no WhatsApp is sent.
- `status_history` records initial and changed request statuses.
- `NEXT_PUBLIC_PERSISTENCE_PROVIDER=local` still runs the local MVP.
- `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase` runs against the real Supabase project without importing local persistence helpers in UI code.
