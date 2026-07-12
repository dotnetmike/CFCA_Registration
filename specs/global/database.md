---
id: global.database
title: Database and migrations
status: active
synced_commit: working-tree
synced_at: 2026-07-13
owners: [team]
files:
  - supabase/migrations/
  - src/lib/db/migrate.ts
  - src/lib/db/deploy.ts
  - scripts/db/deploy.ts
---

# Database and migrations

## Purpose

Postgres via Supabase; schema changes only through numbered SQL migrations.

## Behavior

- Migrations live in `supabase/migrations/` (`000_?` onward).
- `npm run dev` / `npm run start` / `npm run db:deploy` apply pending migrations.
- App tables use service-role client; RLS disabled; authorization in API layer.
- Important recent migrations:
  - `010_transport_contacts.sql` ? pickup/dropoff transport contacts
  - `011_payment_attribution_and_notes.sql` ? payment attribution + admin notes
  - `012_souvenir_orders.sql` ? `souvenir_orders` JSONB (t-shirt size/qty pre-orders)

## Acceptance criteria

- [ ] New schema changes ship as a new migration file (never edit applied migrations in place on shared envs)
- [ ] Deploy logs show applied migrations

## Related specs

- `features.registration`
- `features.audit`
- `features.dashboard`
