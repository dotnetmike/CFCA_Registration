---
id: global.database
title: Database and migrations
status: active
synced_commit: working-tree
synced_at: 2026-07-11
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
- One registration per user when `user_id` set (partial unique index). Guest regs may have `user_id` null.
- Accommodation place fields remain `hotel_name` / `hotel_address` in DB; UI labels say Accommodation name/address.
- Transport contacts: `pickup_transport_contact_name`, `pickup_transport_contact_phone`, `dropoff_transport_contact_name`, `dropoff_transport_contact_phone`.

## Acceptance criteria

- [ ] New schema changes ship as a new migration file (never edit applied migrations in place on shared envs)
- [ ] Deploy logs show applied migrations

## Related specs

- `features.registration`
- `features.audit`
- `features.password-reset`
