---
id: features.audit
title: Audit log
status: active
synced_commit: working-tree
synced_at: 2026-07-11
owners: [team]
files:
  - src/lib/audit/log.ts
  - src/lib/audit/registration.ts
  - src/app/api/admin/audit-log/route.ts
  - src/app/dashboard/audit/page.tsx
  - supabase/migrations/007_password_reset_and_audit.sql
---

# Audit log

## Purpose

Record security- and data-sensitive actions with datetime, user, action, previous/updated values.

## Behavior

- Table `audit_log`: `created_at`, `user_id`, `action`, `previous_value`, `updated_value`, metadata, IP, user agent.
- Sensitive fields redacted (`password_hash`, tokens).
- Instrumented: login/logout/signup, password change/reset, registration create/update/submit, user admin, payment reconcile/record/manual_update, registration note create.
- Admin UI `/dashboard/audit` requires `users:manage`.

## Acceptance criteria

- [ ] Mutations of interest write an audit row
- [ ] Manual payment updates and admin notes are audited
- [ ] Passwords never stored in clear text in audit JSON

## Related specs

- `global.auth-security`
- `features.dashboard`
