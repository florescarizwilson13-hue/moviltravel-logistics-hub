# Moviltravel Logistics Hub Architecture

Moviltravel Logistics Hub is a new standalone logistics platform. It does not share database tables, Supabase projects, or application modules with previous systems.

## Layers

- `src/app`: Next.js routes and route-level composition.
- `src/components`: visual components only.
- `src/modules`: business logic organized by logistics domain.
- `src/lib`: infrastructure adapters, shared services, constants, validators, AI and message helpers.
- `src/lib/supabase`: the only place where Supabase clients are configured.
- `src/lib/local`: temporary local/mock persistence used before the real Supabase project is configured.
- `src/lib/repositories`: persistence interfaces and adapters. UI and feature modules should use this layer instead of reading `localStorage` or Supabase directly.
- `src/types`: domain types shared by UI, modules and infrastructure.

## Module Boundary

Each logistics process should get its own folder under `src/modules`. Visual code can call module services, but business rules must not live inside React components.

## Current Modules

- `transfer-requests`: creation, completeness and status helpers for transfer requests.
- `drivers`: driver profile and availability helpers.
- `messaging`: WhatsApp message preparation and persistence.
- `ai-capture`: provider-based capture service using a mock provider for now.

## Persistence Repositories

The app now resolves persistence through `src/lib/repositories/factory.ts`.

- `NEXT_PUBLIC_PERSISTENCE_PROVIDER=local` or an unset value uses the local adapter.
- `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase` is reserved for the future Supabase adapter.
- Repository interfaces live in `src/lib/repositories/types.ts`.
- The current local implementation lives in `src/lib/repositories/local`.
- The Supabase skeleton lives in `src/lib/repositories/supabase` and intentionally throws until implemented.

The local adapter still uses versioned `localStorage` through `src/lib/local/logistics-store.ts`, but UI screens now receive it through repository methods. Status transitions and business decisions stay in `src/modules`.

Repository groups prepared for Supabase:

- `transferRequests`: create, update, mark ready and assign driver.
- `drivers`: create, update and activate/deactivate.
- `messages`: list by request and latest generated messages.
- `aiConversations`: placeholder for saving provider conversations.
- `dashboard`: operational aggregation.

Driver management follows the same boundary:

- UI lives in `src/components/drivers`.
- Business helpers live in `src/modules/drivers`.
- Temporary persistence lives in `src/lib/local/logistics-store.ts`.
- Supabase replacement should preserve the repository action surface: create, update, activate and deactivate drivers.

## Supabase Transition

When the independent Supabase project is ready:

1. Keep Supabase client setup isolated in `src/lib/supabase`.
2. Implement `src/lib/repositories/supabase` using the same interfaces as the local adapter.
3. Map database rows to the domain types in `src/types` at the repository boundary.
4. Switch the environment variable to `NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase`.
5. Keep React components unchanged unless a new user-facing workflow is required.
