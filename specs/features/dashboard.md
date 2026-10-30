---
id: features.dashboard
title: Manager dashboard
status: active
synced_commit: working-tree
synced_at: 2026-10-30
owners: [team]
files:
  - src/app/dashboard/page.tsx
  - src/components/layout/dashboard-subnav.tsx
  - src/lib/dashboard/registrations-list-cache.ts
  - src/lib/dashboard/list-cache.ts
  - src/lib/dashboard/users-list-cache.ts
  - src/lib/dashboard/audit-list-cache.ts
  - src/lib/dashboard/reports-cache.ts
  - src/lib/dashboard/reports-summary.ts
  - src/components/dashboard/early-bird-capacity-panel.tsx
  - src/components/dashboard/state-headcount-map.tsx
  - src/lib/dashboard/state-headcount.ts
  - src/lib/dashboard/australia-states-map.ts
  - scripts/maps/generate-australia-states.ts
  - src/lib/registrations/people-count.ts
  - src/lib/dashboard/invalidate-registration-caches.ts
  - src/lib/dashboard/reconciled-amounts-cache.ts
  - src/app/api/payments/reconciled-amounts/route.ts
  - src/lib/reconciliation/reconciled-amounts.ts
  - src/app/dashboard/users/page.tsx
  - src/app/dashboard/settings/page.tsx
  - src/app/dashboard/reports/page.tsx
  - src/app/dashboard/registrations/[id]/page.tsx
  - src/app/dashboard/audit/page.tsx
  - src/app/api/admin/users/route.ts
  - src/app/api/admin/registration-settings/route.ts
  - src/app/api/registration-settings/route.ts
  - src/app/api/admin/reports/route.ts
  - src/app/api/registrations/[id]/resend-email/route.ts
  - src/lib/dashboard/registration-list-filters.ts
  - src/lib/dashboard/download-csv.ts
  - src/app/api/admin/audit-log/route.ts
  - src/app/api/registrations/[id]/payment/route.ts
  - src/app/api/registrations/[id]/notes/route.ts
  - src/components/dashboard/stat-card.tsx
  - src/components/dashboard/welcome-panel.tsx
  - src/components/dashboard/dashboard-panel.tsx
  - src/lib/auth/user-groups.ts
  - src/lib/registration-settings.ts
---

# Manager dashboard

## Purpose

Staff tools: list registrations, users, reports, payment reconcile.

## Behavior

- Protected; non-managers redirected away.
- **Dashboard submenu** (`DashboardSubnav`) appears on all `/dashboard/**` staff pages for consistent navigation:
  - Registrations (`/dashboard`)
  - Reports (`/dashboard/reports`)
  - Payment Reconcile (`/dashboard/payments/reconcile`) when `payments:reconcile` — behavior in `features.payment-reconciliation`
  - Users (`/dashboard/users`) when `users:manage`
  - Registration Settings (`/dashboard/settings`) when `users:manage`
  - Audit Log (`/dashboard/audit`) when `users:manage`
  - Backups (`/dashboard/backups`) when `backups:manage` (admins) — behavior in `features.registration-backups`
- Opening the Registrations list as an admin (`backups:manage`) triggers the daily automatic backup check and shows its status line (`features.registration-backups`).
- Active item is highlighted from the current path.
- Site header also exposes a **Dashboard** dropdown submenu (managers) with the same permission-gated links.
- Registration list searchable; detail at `/dashboard/registrations/[id]`.
- **KPI strip** (for the current filtered set): **Reconciled in bank**, Paid, Collected, Balance due.
  - **Reconciled in bank** = money confirmed in the CBA account by payment reconciliation (`features.payment-reconciliation`): bank transfers applied from the CBA statement (reversals deducted) **plus** the **net** of matched Stripe payments minus refunds whose payout has been received in the bank. Hint shows the split: bank transfers, Stripe net, and Stripe fees.
  - It is lower than **Collected** because Stripe fees are deducted before payout, and because payments not yet reconciled (Stripe payouts not yet in a bank statement, manual payments) are excluded.
  - Loaded from `GET /api/payments/reconciled-amounts` (`registrations:read_all`; per-registration `{ bank, stripeNet, stripeFees }`) with its own client cache, refreshed by **Refresh** and cleared with the other registration caches.
- **Filters** on the list: payment status, accommodation required, transpo required, state, **souvenir pre-order** (combinable with search). Filters apply to the **full** loaded set, then results are paginated.
- **Paging**: default **100** rows per page; prev/next and page indicator (Registrations, Users, Audit).
- **Client cache**: list/summary pages use in-browser caches (memory + sessionStorage when small; TTL + max row cap) to avoid repeat fetches when navigating back; **Refresh** forces a re-fetch and replaces the cache. Any successful change to registration or payment data from the browser (registration detail **Save** / payment update, reconciliation upload / **Re-check unmatched** / Ignore / Override) clears the Registrations, Reconciled in bank and Reports caches, so the next visit shows the new payment status immediately. Caches are per browser tab: other tabs or other admins see changes after their 5-minute TTL or **Refresh**.
- Registration list columns include: Reg No, Name, State, Payment, Amount, Submitted, plus:
  - **Actions** column with explicit **View** and **Edit** buttons (Edit opens detail in edit mode when permitted)
  - **Export CSV** exports **all rows matching current filters** (not only the current page), using the same detailed column set as Reports
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

### Registration settings (`/dashboard/settings`, `users:manage`)

- Admin-only runtime controls:
  - `registration_open` force toggle (on/off override)
  - Opening date (`registration_start_date`) and closing date (`registration_end_date`) to automatically manage registration availability
  - Early bird start/end dates and configurable delegate capacity caps (default: 200 interstate, 250 Victoria)
  - **Email Copies**: "Copy all registrant emails to (BCC)" address (`notification_recipient_email`); behavior in `global.email`
  - Attendee pricing (adult 18+ early bird, adult 18+ regular, child 12–17, child 2–11; 0–1 free) — rules in `features.registration`
  - **Registration payment workflow** `registration_workflow`: `v1` (classic, default) or `v2` (online payment capability). Change is audited.
  - **Bank Transfer Details**: CFCA account name, BSB (6 digits, saved as `123-456`), account number (4–10 digits). Shown on payment pages; warning shown in Settings while incomplete. Change is audited (`settings.bank_details_changed`).
  - **Enable souvenir pre-order** `souvenir_preorder_enabled` (default **off**): shows/hides the public form’s Souvenir pre-order section and gates new souvenir orders server-side. Change is audited (`settings.souvenir_preorder_changed`).
- Changes save via `PATCH /api/admin/registration-settings` and apply without redeploy.
- Public read model exposed by `GET /api/registration-settings` for form pricing display and active workflow.

### Reports (`/dashboard/reports`)

- Summary view uses **client cache** + **Refresh**.
- Layout includes:
  - **KPI cards**: registrations, total people (breakdown: registrations · spouses · additional adults · kids), collected (of total registration fees), balance due
  - **Welcome panel** with staff name + quick links
  - **Charts**: payment-status distribution, registrations by state, people composition (registrations / spouses / additional adults / kids)
  - **Registration headcount per state** (visual report, replaces the former summary-by-state table): white poster-style panel with the official CFCA logo ("Couples for Christ Australia (Established August 1988)") top left; top-right blue banner "CFCA National Conference 2027 / Current Registration Headcount / Per State"; a realistic map of Australia divided by state (Natural Earth boundaries) with each state shaded darker the more attendees it has; a callout card with leader line for **every** state and territory (NSW, VIC, QLD, SA, WA, TAS, NT, ACT) — blue header strip with the state code, then the state's total attendees and its age breakdown **Kids (2–11)**, **Teens (12–17)**, **Adults (18+)** — showing 0 when none; and a **Total registrations** card (same blue header style, people icon, total attendees with the same Kids / Teens / Adults breakdown, and "as of <date>" in the card footer) (Melbourne date the summary was loaded, e.g. "28 Oct 2026"). Age bands match the pricing bands (`getAttendeeAgeBand`): adults = registrant + attending spouse + additional attendees 18+; an **Infants (0–1)** row is added to every card only when at least one infant is registered, so each card's bands always add up to its total. Counts are **all attendees**, i.e. the same "total people" as the Attendees KPI, from all submitted registrations in the summary; the total card always equals the sum of the state cards (plus any registrations with no recognised state).
    - **Show filter** (checkboxes above the map, not saved, resets on reload): **Adults (18+)**, **Kids (2–11)**, **Teens (12–17)**, all ticked by default. At least one must stay ticked (the last ticked box is disabled). **All three ticked** = full view above, counting everyone (infants 0–1 included, so the total matches the Attendees KPI). **Exactly one group** = simplified view: each state card shows a single number (header + count, no breakdown) and the total card shows the group total with a note "(Adults 18+ only)" / "(Kids 2–11 only)" / "(Teens 12–17 only)". **Two groups** = breakdown view limited to the ticked groups; card and total numbers are the sum of the ticked groups. Map shading always follows the displayed numbers. People on registrations with no recognised state are included in the total and noted in the card ("Includes N with no state recorded").
  - **Early bird capacity** panel: window dates (effective end = earlier of early-bird end and early-bird payment due date), Open / Closed and the payment due date; one card per capacity group — **Victoria** (VIC cap) and **Interstate** (one cap shared by all other states) — showing **adults confirmed (paid)** / capacity, % confirmed, remaining (highlighted when ≤ 10% left) and adults **reserved, awaiting payment**; and a per-state table (Confirmed adults (paid), Reserved adults (unpaid), capacity group, group capacity, group remaining) listing every state.
  - Counting matches the early-bird rules in `features.registration` (`earlyBirdAdultTally`): submitted registrations holding early bird, counted **per adult** (registrant, spouse, additional adults 18+, up to the registration's early-bird adult limit). Only adults covered by payment are **confirmed** and use capacity; unpaid early-bird adults are shown as **reserved**. Caps and dates come from Registration Settings. Adults moved to the regular rate by early-bird expiry release their place.
  - The Registrations dashboard has no early-bird figures; Reports is the single place for early-bird capacity.
- **People counts always include every additional attendee** (`src/lib/registrations/people-count.ts`): one registrant per registration + spouse (when attending) + additional adults (attendees aged 18+) + kids (attendees under 18) = total people. Kids are also split into teens (12–17), children (2–11) and infants (0–1) in the reports summary (additive fields). There is no separate "registrants" column because it always equals registrations.
  - **Export Detailed CSV** panel (always fetches a fresh full export from the API, not from the summary cache)
- CSV includes **all registrant attributes** currently on the registration row (dynamic column union so newly added columns appear automatically), plus flattened spouse/attendee helpers as needed:
  - Excludes secrets/tokens (`view_token_hash`, `signup_token_hash`, related token timestamps).
  - Additional attendees exported as readable text, e.g. `John Smith (age 0) (kids supervision), Mary Smith (age 15)`.
  - Count columns: `kids_count` (additional attendees under 18), `additional_adults_count` (18+), `attendees_count` (all additional attendees), `total_people` (registrant + spouse + additional attendees).
  - Souvenir orders exported as readable text, e.g. `1 x Small (S), 1 x Large (L)`.
- JSON reports payload also returns `totals` and `paymentStatusCounts` for the KPI/chart widgets.

### Registration detail (`/dashboard/registrations/[id]`)

- Managers can **view all** registration details (personal, address, spouse, attendees, accommodation, transport/flights, payment summary, references).
- Labels use **Unique Code** (not Payment Reference) for `participant_reference`.
- **Default: read-only** for registration fields.
- **Edit** button (when user has `registrations:write_all` and/or `accommodation:write_all`) enables editing for permitted sections.
- Entering edit mode shows a **warning**; **Save** requires confirmation.
- If Save detects **no field changes**, do not call the API; show “No changes to save”.
- **Resend email** button (when user can edit) calls `POST /api/registrations/[id]/resend-email` to send the confirmation or update email again; confirmation resends include a **new magic-link view token**. Action is audited (`registration.email_resend`).

### Payment (admin)

- Show Payment status badge, Registration fee, Amount paid, Balance due (canonical wording in `features.payment`). Status filter, list badges, admin status selector, and reports chart use the friendly status labels (Unpaid / Part paid / Paid / Overpaid); stored values are unchanged.
- Admins with `payments:reconcile` or `registrations:write_all` can update **payment status** and **amount paid**.
- Manual updates set `payment_last_updated_source = manual`, `payment_last_updated_at`, `payment_last_updated_by`; show admin name + date/time.
- Bank reconciliation (CBA CSV, see `features.payment-reconciliation`) sets source `bank_reconcile` the same way and writes a `payments` row linked to the bank line.
- Manual payment updates write `payments` row (`source: manual`) and audit `payment.manual_update`.

### Admin notes

- Admins can add **comment-style notes** on a registration (`registration_admin_notes`).
- Notes show author name + date/time; creating a note is audited (`registration.note_create`).

### Accommodation / Transportation

- Separate sections as previously specified (accommodation name/address; transport contacts with same-contact option).

## Acceptance criteria

- [ ] Dashboard filters by payment status, accommodation, transpo, state
- [ ] Admin can update payment status/amount with source attribution + audit
- [ ] Balance due displayed using the canonical payment wording
- [ ] Admin notes can be added and are audited
- [ ] Unique Code label used for payment code
- [ ] Registrations / Users / Audit pages at 100 per page; client cache with TTL/cap and Refresh
- [ ] Reports summary uses client cache + Refresh, with KPI cards and charts (payment status, by state, composition)
- [ ] Reports shows the per-state headcount map (logo top left, title banner top right, all-attendee count per state with Kids (2–11) / Teens (12–17) / Adults (18+) on a map of Australia, total card in sync with the state cards with the same breakdown and "as of" date), with an Adults / Kids / Teens show filter (all ticked by default, at least one always ticked; one group = single-number cards and an "only" note on the total) in place of the summary-by-state table
- [ ] Detailed CSV exports all non-secret registration attributes and attendees JSON; new columns included automatically
- [ ] Registrations list shows KPI strip for the current filtered set
- [ ] "Reconciled in bank" card shows bank transfers + Stripe net (after fees) received in the bank for the filtered registrations, with the fee breakdown
- [ ] Filter for registrants who pre-ordered souvenirs
- [ ] Admin can update user roles/groups from Users page
- [ ] Role update is audited and revokes target user sessions
- [ ] Dashboard submenu (and header Dashboard dropdown) for staff navigation
- [ ] Registrations list has View/Edit actions and filtered CSV export (all matching rows)
- [ ] Admin can resend registration email from registration detail with audit log
- [ ] Admin can update runtime registration settings without redeploy

## Related specs

- `features.audit`
- `features.payment`
- `global.auth-security`
- `global.layout-and-navigation`
- `features.registration`
- `global.database`
