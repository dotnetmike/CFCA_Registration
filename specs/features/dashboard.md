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
- Registration list searchable; detail at `/dashboard/registrations/[id]`.
- Registration list columns include: Reg No, Name, State, Payment, Amount, Submitted, plus:
  - **Accommodation required** (`billet` → Yes, `own` → No)
  - **Transpo required** (none / pickup / dropoff / both, from airport flags)
  - **Accommodation contact** (name + phone)
  - **Transpo contact** (pickup and/or dropoff name + phone)

### Registration detail (`/dashboard/registrations/[id]`)

- Managers can **view all** registration details (personal, address, spouse, attendees, accommodation, transport/flights, payment summary, references).
- **Default: read-only** (fields not editable).
- **Edit** button (when user has `registrations:write_all` and/or `accommodation:write_all`) enables editing for permitted sections.
- Entering edit mode shows a **warning** that changes affect the registrant’s record.
- **Save** requires an explicit **confirmation** dialog before calling the API.
- Cancel exits edit mode and restores loaded values without saving.

### Accommodation section

- Separate from transportation.
- Labels: **Accommodation name** and **Accommodation address** (stored as `hotel_name` / `hotel_address`).
- Includes accommodation type, name, address, and accommodation contact name/phone.

### Transportation section

- Separate card for airport transport, flight details, and transport contacts.
- Transport selection drives which fields show: `own` (none) / `pickup` / `dropoff` / `pickup_dropoff` (both).
- Admin can assign **transport contact name** and **contact phone** per direction (pickup and/or dropoff).
- When both pickup and dropoff are selected, admin can choose **Same contact for pickup and drop-off** (default when contacts already match) to enter one pair and apply to both; otherwise enter pickup and dropoff contacts separately.

## Acceptance criteria

- [ ] Permission checks on admin APIs
- [ ] Participants cannot access dashboard
- [ ] Registration detail shows full information read-only by default
- [ ] Edit requires warning; save requires confirmation
- [ ] Accommodation and Transportation are separate sections
- [ ] Transport contacts follow pickup/dropoff/none/both; same-contact option when both
- [ ] Dashboard list shows accommodation/transpo required and contact columns

## Related specs

- `features.audit`
- `global.auth-security`
- `features.registration`
