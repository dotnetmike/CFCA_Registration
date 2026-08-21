---
id: features.audit
title: Audit log
status: active
synced_commit: 743bec3
synced_at: 2026-08-20
owners: [team]
files:
  - src/lib/audit/log.ts
  - src/lib/audit/registration.ts
  - src/app/api/admin/audit-log/route.ts
  - src/app/dashboard/audit/page.tsx
  - src/lib/dashboard/audit-list-cache.ts
  - src/lib/dashboard/list-cache.ts
  - supabase/migrations/007_password_reset_and_audit.sql
---

# Audit log

## Purpose

Record security- and data-sensitive actions with datetime, user, action, previous/updated values.

## Behavior

- Table `audit_log`: `created_at`, `user_id`, `action`, `previous_value`, `updated_value`, metadata, IP, user agent.
- Sensitive fields redacted (`password_hash`, tokens).
- Instrumented: login/logout/signup, password change/reset, registration create/update/submit, user admin, payment reconcile/record/manual_update, registration note create.
- **No-op registration updates** (no field/attendee changes) do not write an audit row.
- Admin UI `/dashboard/audit` requires `users:manage`.
- UI loads a capped recent set (same max as other dashboard list caches), **caches client-side** (TTL + Refresh), and **pages at 100** rows.
- API `GET /api/admin/audit-log` supports `limit` (max **1500**) and `offset` for server-side range when needed.

## Acceptance criteria

- [ ] Mutations of interest write an audit row
- [ ] Empty/no-op registration updates are not audited
- [ ] Manual payment updates and admin notes are audited
- [ ] Passwords never stored in clear text in audit JSON
- [ ] Audit UI supports 100/page paging, client cache, and Refresh

## Related specs

- `global.auth-security`
- `features.dashboard`
