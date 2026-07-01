# Workflows

## Transfer Request Intake

1. Create a request even if data is missing.
2. Capture or edit fields progressively.
3. Evaluate completeness using `src/modules/transfer-requests/completeness.ts`.
4. Incomplete requests become `incomplete`.
5. Complete requests become `pending_review`.
6. A coordinator marks reviewed requests as `ready_to_assign`.
7. Assign driver and generate WhatsApp messages with status `generated`.
8. Continue through `confirmed`, `in_progress`, `completed` or `cancelled`.

## Assignment

Assignment logic should stay in modules. UI components should only render state and trigger actions.

Drivers are currently managed locally from `/drivers`. Only active local drivers are available during assignment. When Supabase is connected, replace local driver persistence with `drivers` table repository calls while keeping assignment rules in modules.

## Persistence Provider

Current workflows use the repository factory in `src/lib/repositories/factory.ts`.

- Default provider: `local`.
- Current storage: browser `localStorage`, wrapped by the local repository adapter.
- Future provider: `supabase`, implemented behind the same repository interfaces.

Screens should call repository methods from the shared store hook instead of importing local persistence helpers directly. This keeps `/dashboard`, `/requests`, `/drivers` and `/ai-capture` ready for a Supabase adapter without changing the visible flow.

## Future Logistics Modules

Add new domains under `src/modules`, with their own service and repository files where needed.

## Dashboard

`/dashboard` reads a repository snapshot and aggregates operational metrics through `src/modules/dashboard`.

It surfaces open requests, attention-required states, generated messages and active drivers. When Supabase is connected, the same dashboard service can receive repository results instead of localStorage data.
