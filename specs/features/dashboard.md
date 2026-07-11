---
id: features.dashboard
title: Manager dashboard
status: active
synced_commit: working-tree
synced_at: 2026-07-11
owners: [team]
files:
  - src/app/dashboard/page.tsx
  - src/app/dashboard/users/page.tsx
  - src/app/dashboard/reports/page.tsx
  - src/app/dashboard/payments/reconcile/page.tsx
  - src/app/dashboard/registrations/[id]/page.tsx
  - src/app/api/admin/users/route.ts
  - src/app/api/admin/reports/route.ts
  - src/app/api/payments/reconcile/route.ts
---

# Manager dashboard

## Purpose

Staff tools: list registrations, users, reports, payment reconcile.

## Behavior

- Protected; non-managers redirected away.
- Nav links: Reports, Payment Reconcile (permission), Users + Audit Log (`users:manage`).
- Registration list searchable; detail edit at `/dashboard/registrations/[id]`.

## Acceptance criteria

- [ ] Permission checks on admin APIs
- [ ] Participants cannot access dashboard

## Related specs

- `features.audit`
- `global.auth-security`
