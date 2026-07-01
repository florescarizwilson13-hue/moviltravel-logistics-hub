# Supabase Transfer Requests Adapter

The Supabase adapter now covers transfer requests and drivers when:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase
```

## Connected To Supabase

- `/requests`
- `/requests/new`
- `/requests/[id]`
- `/drivers`

The adapter reads and writes:

- `public.transfer_requests`
- `public.drivers`

## Supported Request Actions

- list requests
- create incomplete or complete request
- update request fields
- recompute status through `src/modules/transfer-requests`
- mark `pending_review` as `ready_to_assign`
- assign a Supabase driver
- save `assigned_driver_id`
- set request status to `assigned`

## Still Local Temporarily

- `request_messages`: assignment messages are generated and kept in the local snapshot for now.
- `ai_conversations`: not connected yet.
- WhatsApp sending: not implemented.
- Dashboard aggregation: reads the shared app snapshot, so it may show Supabase requests/drivers plus local messages while the full dashboard repository is pending.
- AI capture: still uses the mock provider; conversation history is not saved to Supabase.

## Fallback

When:

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=local
```

all request, driver, message, AI and dashboard flows continue using the existing localStorage fallback.

## Manual Test

1. Set `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase`.
2. Restart `npm run dev`.
3. Login with an admin or coordinator user.
4. Open `/requests`.
5. Create an incomplete request from `/requests/new`.
6. Open the request detail and complete missing fields.
7. Mark it as ready to assign.
8. Assign an active driver from Supabase.
9. Confirm the row in Supabase Table Editor > `transfer_requests` has:
   - expected passenger/company/route fields
   - `status = assigned`
   - `assigned_driver_id` set

## Pending Before Full Supabase Operations

- Persist generated request messages in `public.request_messages`.
- Connect dashboard queries deliberately.
- Connect AI capture conversations to `public.ai_conversations`.
- Add role-specific UI restrictions for viewer/coordinator.
- Decide migration/export path for browser localStorage data.
