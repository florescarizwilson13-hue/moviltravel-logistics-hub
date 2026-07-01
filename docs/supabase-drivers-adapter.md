# Supabase Drivers Adapter

The first real Supabase adapter is limited to `/drivers`.

## Scope

When `NEXT_PUBLIC_PERSISTENCE_PROVIDER=local`:

- `/drivers` uses the existing localStorage layer.
- Requests, dashboard, AI and messages keep the current local behavior.

When `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase`:

- `/drivers` reads and writes `public.drivers` through Supabase Auth and RLS.
- Requests, dashboard, AI and messages still use local fallback data.
- No service role key is used in the browser.

## Required Environment

Local mode:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=local
```

Supabase drivers mode:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://rxgwimwuabtibrpfgkuq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
AI_PROVIDER=mock
```

Do not add `SUPABASE_SERVICE_ROLE_KEY` for this flow.

## Manual Test

1. Set `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase` in `.env.local`.
2. Restart `npm run dev`.
3. Login with `wflores@moviltravel.cl`.
4. Open `/drivers`.
5. Create a driver.
6. Edit that driver.
7. Deactivate and activate the driver.
8. Confirm the row exists in Supabase Table Editor > `drivers`.

To return to local fallback:

1. Set `NEXT_PUBLIC_PERSISTENCE_PROVIDER=local`.
2. Restart `npm run dev`.
3. Open `/drivers` and confirm local drivers are shown.

## Pending

- Transfer requests still use local persistence.
- Assignment still stores request changes locally.
- Messages, AI conversations and dashboard aggregation are not yet Supabase-backed.
- Viewer/coordinator UI restrictions for driver management can be refined after role-specific accounts are tested.
