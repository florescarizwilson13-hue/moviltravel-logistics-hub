# Auth Implementation Plan

Goal: connect Supabase Auth login to the app without changing persistence. The app must continue using `NEXT_PUBLIC_PERSISTENCE_PROVIDER=local` while Auth is tested.

## Current State

- Supabase project: `moviltravel-logistics-hub`
- Project ref: `rxgwimwuabtibrpfgkuq`
- Project URL: `https://rxgwimwuabtibrpfgkuq.supabase.co`
- Region: `sa-east-1`
- Migration `0001_initial_schema.sql` applied.
- Migration `0002_auth_roles.sql` applied.
- User `wflores@moviltravel.cl` exists and is promoted to `admin`.
- Supabase Auth is connected in the app.
- Real login was tested successfully with `wflores@moviltravel.cl`.
- `/dashboard` loads after login.
- Layout shows user `wflores@moviltravel.cl` and role `Admin`.
- App persistence remains local.
- Local dashboard data still works after login.
- Logout remains pending for final manual verification.

## Environment Variables

Auth requires these values in `.env.local`:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=local
NEXT_PUBLIC_SUPABASE_URL=https://rxgwimwuabtibrpfgkuq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
AI_PROVIDER=mock
```

`SUPABASE_SERVICE_ROLE_KEY` is not required for browser login and must not be used in client code.

## 1. Required Routes And Screens

### `/login`

- Public route.
- Email/password login against Supabase Auth.
- If a valid session exists, redirect to `/dashboard`.
- Show clear errors for invalid credentials, inactive profile or missing profile.

### `/logout`

- Route or server action that signs out from Supabase.
- Redirects to `/login`.
- Should clear only Supabase session state, not local logistics data.

### Protected App Routes

Protect the operational app shell:

- `/dashboard`
- `/requests`
- `/requests/new`
- `/requests/[id]`
- `/drivers`
- `/vehicles`
- `/messages`
- `/ai-capture`

Unauthenticated users should redirect to `/login`.

## 2. Reading Profile And Role

After Supabase session validation, read:

```sql
select id, full_name, role, active
from profiles
where id = auth.uid();
```

Application-level shape:

- `id`
- `email`
- `fullName`
- `role`: `admin | coordinator | viewer`
- `active`

Rules:

- If no session: redirect to `/login`.
- If profile is missing: sign out or show access error.
- If `active = false`: sign out or show access disabled.
- If profile exists and active: allow app shell access based on role.

## 3. Who Can Enter

Allowed into the protected app:

- `admin`
- `coordinator`
- `viewer`

Blocked:

- anonymous users
- users without profile
- inactive users
- users with unknown role

Initial UI role gates can be simple:

- `admin`: access all current screens.
- `coordinator`: access all operational screens, but future admin settings should be hidden.
- `viewer`: can enter dashboard and read-only screens. Until read-only UI states exist, avoid exposing mutation actions or block them server-side.

## 4. Keeping Provider Local During Auth

Do not change:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=local
```

Auth and persistence are separate during this phase:

- Supabase Auth controls who can open the app.
- Operational data still comes from the local repository/localStorage.
- The Supabase adapter remains unimplemented.
- This lets login/session behavior be tested without risking request, driver or message workflows.

## 5. Risks

- Middleware/session mismatch can cause redirect loops.
- RLS may block profile reads if the session is not correctly sent to Supabase.
- Viewer users can see local mutable UI unless role-based UI states are added.
- Email/password settings may not be enabled or confirmed in Supabase Auth.
- Local data remains per-browser, so authenticated users may see different local mock data.
- Accidentally setting `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase` will hit the placeholder adapter.
- Service role key must never be used in browser code.

## 6. Implementation Order

1. Confirm `.env.local` contains Supabase URL and anon key, while provider remains `local`.
2. Add Supabase browser/server client helpers if current helpers are incomplete.
3. Add session/profile loader utility.
4. Add `/login` route and login form.
5. Add logout action/route.
6. Protect app routes with middleware or route-level guard.
7. Add current user/role display in the app shell.
8. Hide or disable mutation controls for `viewer` if a viewer account is introduced.
9. Test with `wflores@moviltravel.cl` as `admin`.

## 7. Acceptance Criteria

- `/login` loads without requiring authentication.
- `wflores@moviltravel.cl` can sign in.
- Signed-in active admin is redirected to `/dashboard`.
- Anonymous users cannot access protected routes.
- `/logout` signs out and redirects to `/login`.
- App still uses `NEXT_PUBLIC_PERSISTENCE_PROVIDER=local`.
- Existing local flows still work after login:
  - dashboard
  - requests
  - drivers
  - ai-capture
- No Supabase service role key appears in client code.
- `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase` is not required for Auth testing.
