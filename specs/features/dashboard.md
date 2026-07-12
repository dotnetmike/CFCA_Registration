---
id: features.dashboard
title: Manager dashboard
status: active
synced_commit: working-tree
synced_at: 2026-07-13
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
  - src/app/api/registrations/[id]/payment/route.ts
  - src/app/api/registrations/[id]/notes/route.ts
---

# Manager dashboard

## Purpose

Staff tools: list registrations, users, reports, payment reconcile.

## Behavior

- Protected; non-managers redirected away.
- Nav links: Reports, Payment Reconcile (permission), Users + Audit Log (`users:manage`).
- Registration list searchable; detail at `/dashboard/registrations/[id]`.
- **Filters** on the list: payment status, accommodation required, transpo required, state (combinable with search).
- Registration list columns include: Reg No, Name, State, Payment, Amount, Submitted, plus:
  - **Accommodation required** (`billet` → Yes, `own` → No)
  - **Transpo required** (none / pickup / dropoff / both, from airport flags)
  - **Accommodation contact** (name + phone)
  - **Transpo contact** (pickup and/or dropoff name + phone)

### Registration detail (`/dashboard/registrations/[id]`)

- Managers can **view all** registration details (personal, address, spouse, attendees, accommodation, transport/flights, payment summary, references).
- Labels use **Unique Code** (not Payment Reference) for `participant_reference`.
- **Default: read-only** for registration fields.
- **Edit** button (when user has `registrations:write_all` and/or `accommodation:write_all`) enables editing for permitted sections.
- Entering edit mode shows a **warning**; **Save** requires confirmation.

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

## Related specs

- `features.audit`
- `features.payment`
- `global.auth-security`
- `features.registration`
- `global.database`
