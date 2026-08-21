---
id: global.database
title: Database and migrations
status: active
synced_commit: 743bec3
synced_at: 2026-08-20
owners: [team]
files:
  - supabase/migrations/
  - src/lib/db/migrate.ts
  - src/lib/db/deploy.ts
  - scripts/db/deploy.ts
  - src/lib/supabase/admin.ts
  - src/lib/supabase/env.ts
---

# Database and migrations

## Purpose

Postgres via Supabase; schema changes only through numbered SQL migrations.

## Behavior

- Migrations live in `supabase/migrations/` (`000_…` onward).
- `npm run dev` / `npm run start` / `npm run db:deploy` apply pending migrations.
- **Security model (required):**
  - All app tables in `public` have **RLS enabled** (`013_enable_rls_revoke_anon.sql`).
  - Roles `anon` and `authenticated` have **no** table/sequence/function privileges on `public`.
  - The Next.js server uses **`SUPABASE_SERVICE_ROLE_KEY`** via `createAdminClient` / `createServerClient` (`src/lib/supabase/admin.ts`). Service role bypasses RLS; product authorization stays in API routes (`requireAuth` / permissions).
  - Do **not** use the publishable/anon key for database CRUD.
  - New tables must `ENABLE ROW LEVEL SECURITY` in the same migration; do not `GRANT` to `anon`/`authenticated`.
- Important recent migrations:
  - `010_transport_contacts.sql` — pickup/dropoff transport contacts
  - `011_payment_attribution_and_notes.sql` — payment attribution + admin notes
  - `012_souvenir_orders.sql` — `souvenir_orders` JSONB (t-shirt size/qty pre-orders)
  - `013_enable_rls_revoke_anon.sql` — RLS on + revoke public Data API grants

## Acceptance criteria

- [ ] New schema changes ship as a new migration file (never edit applied migrations in place on shared envs)
- [ ] Deploy logs show applied migrations
- [ ] Public Data API with publishable/anon key cannot read or mutate app tables
- [ ] Server admin client uses service role key only

## Related specs

- `global.auth-security`
- `features.registration`
- `features.audit`
- `features.dashboard`
