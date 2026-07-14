---
id: features.dashboard
title: Manager dashboard
status: active
synced_commit: working-tree
synced_at: 2026-07-14
owners: [team]
files:
  - src/app/dashboard/page.tsx
  - src/components/layout/dashboard-subnav.tsx
  - src/lib/dashboard/registrations-list-cache.ts
  - src/lib/dashboard/list-cache.ts
  - src/lib/dashboard/users-list-cache.ts
  - src/lib/dashboard/audit-list-cache.ts
  - src/lib/dashboard/reports-cache.ts
  - src/app/dashboard/users/page.tsx
  - src/app/dashboard/reports/page.tsx
  - src/app/dashboard/payments/reconcile/page.tsx
  - src/app/dashboard/registrations/[id]/page.tsx
  - src/app/dashboard/audit/page.tsx
  - src/app/api/admin/users/route.ts
  - src/app/api/admin/reports/route.ts
  - src/app/api/admin/audit-log/route.ts
  - src/app/api/payments/reconcile/route.ts
  - src/app/api/registrations/[id]/payment/route.ts
  - src/app/api/registrations/[id]/notes/route.ts
  - src/lib/auth/user-groups.ts
---

# Manager dashboard

## Purpose

Staff tools: list registrations, users, reports, payment reconcile.

## Behavior

- Protected; non-managers redirected away.
- **Dashboard submenu** (`DashboardSubnav`) appears on all `/dashboard/**` staff pages for consistent navigation:
  - Registrations (`/dashboard`)
  - Reports (`/dashboard/reports`)
  - Payment Reconcile (`/dashboard/payments/reconcile`) when `payments:reconcile`
  - Users (`/dashboard/users`) when `users:manage`
  - Audit Log (`/dashboard/audit`) when `users:manage`
- Active item is highlighted from the current path.
- Site header also exposes a **Dashboard** dropdown submenu (managers) with the same permission-gated links.
- Registration list searchable; detail at `/dashboard/registrations/[id]`.
- **Filters** on the list: payment status, accommodation required, transpo required, state, **souvenir pre-order** (combinable with search). Filters apply to the **full** loaded set, then results are paginated.
- **Paging**: default **100** rows per page; prev/next and page indicator (Registrations, Users, Audit).
- **Client cache**: list/summary pages use in-browser caches (memory + sessionStorage when small; TTL + max row cap) to avoid repeat fetches when navigating back; **Refresh** forces a re-fetch and replaces the cache.
- Registration list columns include: Reg No, Name, State, Payment, Amount, Submitted, plus:
  - **Accommodation required** (`billet` → Yes, `own` → No)
  - **Transpo required** (none / pickup / dropoff / both, from airport flags)
  - **Accommodation contact** (name + phone)
  - **Transpo contact** (pickup and/or dropoff name + phone)

### User management (`/dashboard/users`, `users:manage`)

- Admins can create users and assign one or more **roles/groups**: `admin`, `registration_manager`, `accommodation_manager`, `participant`.
- Admins can **update an existing user’s roles** via `PATCH /api/admin/users` (`userId` + `groups`).
- Role changes are audited (`user.update`) and **revoke all sessions** for that user so new permissions apply on next login.
- UI: per-user role editor (checkboxes) with Save; loading disables the trigger.
- Users list: **client cache** + **100/page** paging + **Refresh** (same pattern as Registrations). Create/role save/revoke clears cache and reloads.

### Reports (`/dashboard/reports`)

- Summary-by-state view uses **client cache** + **Refresh**.
- **Export Detailed CSV** always fetches a fresh full export from the API (not from the summary cache).
- CSV includes **all registrant attributes** currently on the registration row (dynamic column union so newly added columns appear automatically), plus flattened spouse/attendee helpers as needed:
  - Excludes secrets/tokens (`view_token_hash`, `signup_token_hash`, related token timestamps).
  - Nested `registration_attendees` exported as a JSON column.
  - Object/array fields (e.g. `souvenir_orders`) exported as JSON strings.

### Registration detail (`/dashboard/registrations/[id]`)

- Managers can **view all** registration details (personal, address, spouse, attendees, accommodation, transport/flights, payment summary, references).
- Labels use **Unique Code** (not Payment Reference) for `participant_reference`.
- **Default: read-only** for registration fields.
- **Edit** button (when user has `registrations:write_all` and/or `accommodation:write_all`) enables editing for permitted sections.
- Entering edit mode shows a **warning**; **Save** requires confirmation.
- If Save detects **no field changes**, do not call the API; show “No changes to save”.

### Payment (admin)

- Show amount due, amount paid, **Remaining balance** (`amount_due − amount_paid`).
- Admins with `payments:reconcile` or `registrations:write_all` can update **payment status** and **amount paid**.
- Manual updates set `payment_last_updated_source = manual`, `payment_last_updated_at`, `payment_last_updated_by`; show admin name + date/time.
- Bank reconcile sets source `bank_reconcile` the same way.
- Manual payment updates write `payments` row (`source: manual`) and audit `payment.manual_update`.

### Admin notes

- Admins can add **comment-style notes** on a registration (`registration_admin_notes`).
- Notes show author name + date/time; creating a note is audited (`registration.note_create`).

### Accommodation / Transportation

- Separate sections as previously specified (accommodation name/address; transport contacts with same-contact option).

## Acceptance criteria

- [ ] Dashboard filters by payment status, accommodation, transpo, state
- [ ] Admin can update payment status/amount with source attribution + audit
- [ ] Remaining balance displayed
- [ ] Admin notes can be added and are audited
- [ ] Unique Code label used for payment code
- [ ] Registrations / Users / Audit pages at 100 per page; client cache with TTL/cap and Refresh
- [ ] Reports summary uses client cache + Refresh
- [ ] Detailed CSV exports all non-secret registration attributes and attendees JSON; new columns included automatically
- [ ] Filter for registrants who pre-ordered souvenirs
- [ ] Admin can update user roles/groups from Users page
- [ ] Role update is audited and revokes target user sessions
- [ ] Dashboard submenu (and header Dashboard dropdown) for staff navigation

## Related specs

- `features.audit`
- `features.payment`
- `global.auth-security`
- `global.layout-and-navigation`
- `features.registration`
- `global.database`
