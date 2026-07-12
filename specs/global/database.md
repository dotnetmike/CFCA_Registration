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
  - `007_password_reset_and_audit.sql` ? password reset tokens, `audit_log`
  - `008_public_registration.sql` ? nullable `user_id`, view/signup tokens
  - `009_unique_registration_email.sql` ? unique `lower(email)` for non-empty emails
  - `010_transport_contacts.sql` ? pickup/dropoff transport contact name + phone
  - `011_payment_attribution_and_notes.sql` ? payment last-update attribution + `registration_admin_notes`
- Payment attribution: `payment_last_updated_source` (`manual` | `bank_reconcile`), `payment_last_updated_at`, `payment_last_updated_by`.
- Admin notes table: `registration_admin_notes`.

## Acceptance criteria

- [ ] New schema changes ship as a new migration file (never edit applied migrations in place on shared envs)
- [ ] Deploy logs show applied migrations

## Related specs

- `features.registration`
- `features.audit`
- `features.password-reset`
- `features.dashboard`
