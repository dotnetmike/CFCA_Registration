---
id: features.registration
title: Registration form
status: active
synced_commit: working-tree
synced_at: 2026-10-26
owners: [team]
files:
  - src/app/page.tsx
  - src/app/register/page.tsx
  - src/components/layout/site-header.tsx
  - src/components/registrations/form-field-label.tsx
  - src/components/ui/help-tooltip.tsx
  - src/lib/registrations/form-tooltips.ts
  - src/components/registrations/registration-form.tsx
  - src/components/registrations/registration-review-summary.tsx
  - src/components/registrations/early-bird-reminders.tsx
  - src/components/registrations/transport-schedule-alert.tsx
  - src/lib/registrations/schema.ts
  - src/lib/registrations/validation.test.ts
  - src/lib/registrations/souvenirs.ts
  - src/lib/registrations/transport.ts
  - src/lib/registrations/email-unique.ts
  - src/lib/registrations/service.ts
  - src/lib/registrations/view-token.ts
  - src/lib/registrations/rate-limit.ts
  - src/lib/registrations/compare.ts
  - src/lib/pricing/calculate.ts
  - src/lib/pricing/early-bird.ts
  - src/lib/registrations/early-bird-claim.ts
  - src/lib/registrations/early-bird-expiry.ts
  - src/lib/registrations/early-bird-expiry-runner.ts
  - src/lib/registrations/early-bird-column.ts
  - src/lib/registrations/reprice.ts
  - scripts/db/reprice-registrations.ts
  - src/lib/registration-settings.ts
  - src/lib/site-url.ts
  - src/app/api/registrations/route.ts
  - src/app/api/registrations/[id]/route.ts
  - src/app/api/registration-settings/route.ts
  - src/app/api/registrations/check-email/route.ts
  - src/lib/email/send.ts
  - supabase/migrations/015_runtime_registration_settings.sql
  - supabase/migrations/014_registration_dietary_requirements.sql
  - supabase/migrations/016_registration_operations_settings.sql
  - supabase/migrations/018_ministry_and_role_options.sql
  - supabase/migrations/022_national_coordinator_role.sql
  - supabase/migrations/023_rename_coordinator_roles.sql
  - supabase/migrations/024_area_and_music_coordinator_roles.sql
  - supabase/migrations/020_souvenir_preorder_toggle.sql
  - supabase/migrations/028_early_bird_adult_limit.sql
---

# Registration form

## Purpose

Single continuous conference registration page. Guests complete without login; logged-in owners can edit. Designed for ease of use and accessibility (non?computer-savvy audience).

## Behavior

### Layout

- **One continuous page** (no Next/Back tabs or step wizard).
- Sections stacked in order, each with a clear numbered heading:
  1. Your details
  2. Other people attending (optional)
  3. Accommodation & transport
  4. Souvenir pre-order (optional) — **only when enabled** in Dashboard Settings (default off)
  5. Review & submit (numbered **4** when the souvenir section is hidden)
- Short intro: fill in the form, then press Submit once at the bottom.
- National Conference reminder shown on the page: **National Conference 2027**.
- Required fields marked with a prominent **red asterisk**; invalid fields show a red border on submit.
- On submit, **all** validation errors are shown together in a summary list (not one-at-a-time).
- Controls use comfortable sizing (`text-base` / taller inputs) for readability and touch.
- Fields that may need extra explanation show a **help icon** (?) beside the label. Mouse hover, keyboard focus, or tap/click on the icon opens a short tooltip with guidance; tap again, tap outside, or press Escape to close.
- Tooltips must stay fully visible on every screen size (phone, tablet, laptop, desktop): they render above other content (not clipped by cards or containers), stay inside the viewport horizontally, flip above the icon when there is no room below, and follow the icon on scroll/resize.
- Multi-column field rows share a consistent label height, control height (`h-12`), and reserved error-message slot so siblings stay aligned (including action buttons such as **Remove**).

### Registration details

- Primary registrant and attendee fields include an optional food allergy and dietary requirements field.
- Australian mobile numbers are validated to the local format (`04xx xxx xxx` or `+61...`).
- Address fields use labels **Address Suburb**, **Address Postcode**, and **Address State** (optional).
- **Ministry** is selected before **Ministry Role**: CFCA, Family Ministries, LIA, PCS, Communications, or Non-Member. Selecting Non-Member locks Ministry Role to Non-member.
- **Ministry Role** options are Member, Household Leader, Unit Leader, HOLD, SOLD, Family Ministry Area Leader, Family Ministry Coordinator, Chapter Leader, Cluster Leader, Sector Leader, LIA Coordinator, PCS Coordinator, Comms Coordinator, National Director, National Council Member, National Coordinator (covers the LIA, Comms, PCS and FM national coordinators), Area Coordinator, and Music Coordinator. Stored values match the labels: `sector_leader`, `lia_coordinator`, `pcs_coordinator`, `comms_coordinator` (renamed in place from the former `sector_leader_national_coordinator`, `lia_area_coordinator`, `pcs_area_coordinator`, `comms_area_coordinator` by migration `023`), `national_coordinator` (added by migration `022`), `area_coordinator` and `music_coordinator` (migration `024`).
- **CFCA Membership State** (required, DB column `state`) is shown on the same row as **Ministry Role** on medium+ screens; on small screens membership state stacks below ministry role.
- When the user selects or changes **Address State** (including via address autocomplete), **CFCA Membership State** is set to the same value automatically.
- Family Ministry Area Leader, Chapter Leader, Cluster Leader, Sector Leader, LIA Coordinator, PCS Coordinator, Comms Coordinator, National Director, National Council Member, and National Coordinator roles may record elder's assembly attendance on Friday, 9 April 2027 with the checkbox label "Attending the elder's assembly on Friday, 9 April 2027". Area Coordinator and Music Coordinator are not eligible.

### Airport transport

- Pickup is available from Thursday, 8 April 2027 to Saturday, 10 April 2027 (7am–10pm) for roles eligible to attend the Elders Assembly. For all other roles, pickup is available from Friday, 9 April 2027 to Saturday, 10 April 2027 (7am–10pm).
- Drop-off is available from Saturday, 10 April 2027 to Sunday, 11 April 2027, 7am–10pm.
- When **Pick-up and/or Drop-off** is selected, users can optionally provide their hotel/accommodation name and address to support transport planning.
  - Pickup only: "Pick-up at Tullamarine is available from [Thursday, 8 April 2027 / Friday, 9 April 2027], 7am–10pm."
  - Pickup + drop-off: "Pick-up and drop-off at Tullamarine: pick-up from [Thursday, 8 April 2027 / Friday, 9 April 2027], 7am–10pm and drop-off Sunday, 11 April 2027, 7am–10pm."
  - Drop-off only (any position): "Drop-off at Tullamarine is available only on Sunday, 11 April 2027, 7am–10pm."
  - All variants note transport from other airports (e.g. Avalon) may not be available.
- Spouse records include an optional food allergy and dietary requirements field if attending.

### Souvenir pre-order (optional)

- Controlled by runtime setting `souvenir_preorder_enabled` (Dashboard → Registration Settings → **Enable souvenir pre-order**). **Default: disabled.**
- When disabled:
  - The section is not rendered and the review summary omits the “Souvenir t-shirts” row (unless the registration already has orders).
  - `POST /api/registrations` stores `souvenir_orders = []`; `PUT /api/registrations/[id]` ignores incoming `souvenir_orders` and keeps existing values (so existing orders and `amount_due` are not changed).
- Managed by **Love In Action**; note that all proceeds support a fund for future projects sharing love and help to others.
- Item: conference **t-shirt**, **$30** each.
- Registrant may pre-order multiple lines by **size** and **quantity** (e.g. 1× Medium + 3× Large).
- Quantity is a **whole number** only (0–50), enforced in the input and validated with a size-specific message (e.g. “T-shirt quantity — Large (L)”).
- Stored as `souvenir_orders` JSON on the registration; total added to `amount_due`.

### Accessibility

- Semantic section headings; error summary at top with focus to first invalid field.
- Labels associated with inputs; checkboxes have accessible names.
- Login link for people who already registered.

### Guest (not logged in)

- Already registered? Login → `/login?redirect=/my-registration`.
- Email uniqueness checked on email blur and on submit. DB/API errors fail closed (HTTP 500), never report `available: true`.
- Duplicate-email conflicts distinguish two cases so the CTA matches reality:
  - `reason: "account"` — an account already exists for that email → show **Login here** (`/login?redirect=/my-registration`).
  - `reason: "unlinked_registration"` — a submitted registration exists but no account has been created for it yet → show **Create your account here** (`/signup?email=<email>&redirect=/my-registration`), never a login link (there is nothing to log into).
- Accommodation and airport transport mandatory with no default.
- Submit → public `POST /api/registrations`.
- **Workflow V1 (default):** redirect `/register/complete`.
- **Workflow V2** (Dashboard “Online payment capability”): CTA **Proceed to Payment** (loading: “Saving registration...”) → `/register/pay` then `/register/complete`. Preview: `/register?workflow=v2`. See `features.registration-workflow-v2`.
- When registration is closed, public submit is blocked with a friendly message to contact Chapter Leaders.

### Logged in

- Load/save via `authFetch`; submit → `/my-registration`.
- No-op saves skipped when nothing changed.
- When registration is closed, owner-level updates are blocked. Admin / Registration Manager / Accommodation Manager can still update registrations.

### Runtime pricing + early bird settings

- Early bird window and attendee pricing are loaded from runtime registration settings (DB-backed), not hardcoded constants.
- Form pricing preview and server-side amount calculations use the same runtime settings.
- **Price per person** (`src/lib/pricing/calculate.ts`, defaults in brackets):
  - Registrant, spouse, and any additional attendee aged **18+** → adult rate: **adult early bird** ($220) for adults holding an early-bird place, otherwise **adult regular** ($240).
  - Additional attendee aged **12–17** → $175. Aged **2–11** → $100. Aged **0–1** → free.
- **Early bird is per adult** (`src/lib/pricing/early-bird.ts`). Adults on a registration are ordered registrant → spouse → additional adults 18+ (in attendee order). `registrations.early_bird_adult_limit` stores how many of them are on the early-bird rate; `NULL` (every registration created before this rule) means all adults.
  - **Capacity** caps in Settings (Victoria, Interstate = every other state) count **adults**, not registrations.
  - **Confirmed** early-bird adults = adults covered by payment: each adult early-bird fee paid confirms one early-bird adult in the order above, i.e. `min(early-bird adults, floor(amount paid ÷ adult early-bird price))`. Only confirmed adults use capacity. Unpaid early-bird adults are **reserved**, not confirmed.
  - **Claiming**: a registration submitted on or before the early-bird **end date** (and on/after the start date) gets early bird for `min(its adults, cap − confirmed adults of other registrations in its pool)` adults. Adults added to a registration later get early bird only while the window is open and the pool has room; otherwise they pay the regular rate (adults already on early bird keep it). Removing adults lowers the early-bird count to the remaining adults.
  - **Expiry** (automatic, daily payment cron): after the early-bird **payment due date**, or once a pool's confirmed adults reach its cap, every early-bird adult on a submitted registration that is not confirmed moves to the regular rate. Adults already covered by payment keep early bird. The fee and payment status are recalculated (amount paid unchanged), an `registration.early_bird_expired` audit row is written, and the registrant is emailed (see `global.email`). Reruns change nothing.
  - Without the `early_bird_adult_limit` column (before migration `028` runs) the app keeps the previous behaviour: all adults of an early-bird registration share its rate, and part-confirmed registrations are not repriced.
  - **Dates** are whole Melbourne calendar days, inclusive: claiming is open from the start date through the earlier of the end date and the payment due date (`earlyBirdClaimEndDate`); the due date has passed from the following Melbourne day.
- **Registrant-facing wording**: wherever early-bird pricing is shown (form review step, registration details, registration emails, payment reminders), an amber **Early Bird Registration – Important Reminders** box lists, as bullets, Limited slots (first-paid, first-served), Payment required (secured only once full payment is received and confirmed), Deadline (the payment due date from settings, or until all early bird slots are filled) and Unpaid registrations (revert to the regular adult rate from settings). Exact wording is in `features.payment`; text comes from `earlyBirdReminders` and the web box is `EarlyBirdReminders` (`early-bird-reminders.tsx`).
  - Review step (`registration-review-summary.tsx`): a green line with the early-bird rate and saving "subject to available places", then the amber Important Reminders box. The cost table is an estimate (places are checked when saving): while claiming is open every adult is shown on early bird; a submitted registration without early bird does not gain it on edit; after claiming closes an edited registration keeps only the adults it already had on early bird.
- **Saving a change that alters the registration fee** (e.g. adding attendees) recalculates **Payment status** from the new fee and the existing amount paid (a Paid registration with a new balance becomes Part paid). Saves that leave the fee unchanged keep the current status.
- `npm run db:reprice-registrations` re-prices saved registrations with the current rules (dry run by default; `--apply` updates fee + payment status, audited as `registration.reprice`, no emails, amount paid unchanged).
- The early-bird payment due date, payment reminder dates, and email copy recipient (`notification_recipient_email`) are runtime settings. The daily payment cron applies early-bird expiry (above) and sends reminders on configured dates.
- When the email copy recipient is set, **every** email sent to a registrant (registration submitted / updated, transport/accommodation updated, payment received, payment reminder, admin resends) is **BCC'd** to it, so registrants never see the address. Password reset emails are never copied because they contain a sign-in link.

### API

- Public POST rate-limited; unique email enforced.
- Authenticated PUT; unchanged payloads return `unchanged: true`.
- Invalid Supabase service-role key surfaces as a configuration error (not a silent email-available success).

### Participant emails (`src/lib/email/send.ts`)

- **Submitted** (`registration_submitted`): full registration summary + magic-link view URL built from the request host (`{origin}/r/{token}`).
- **Updated** (`registration_updated` / `accommodation_updated`): full registration summary including hotel/accommodation name/address and accommodation/transport contacts when set; includes a portal link to `/my-registration` (login required via proxy redirect).
- Accommodation/transport contact lines appear only when applicable (values present / transport flags).

## Acceptance criteria

- [ ] On submit, all validation errors are shown together in a summary list
- [ ] Required fields use a prominent red asterisk and red border when invalid
- [ ] Souvenir pre-order section hidden by default; shown only when enabled in Dashboard Settings
- [ ] When disabled, APIs do not accept new souvenir orders and keep existing ones
- [ ] Optional t-shirt pre-order with size/qty at $30 each
- [ ] Love In Action proceeds note shown
- [ ] Souvenir total included in amount due
- [ ] National Conference reminder shown as National Conference 2027
- [ ] Food allergy and dietary requirements field is available for registrants, spouses, and attendees
- [ ] Australian mobile validation is enforced
- [ ] Ministry and Ministry Role enforce the Non-member role invariant
- [ ] Eligible ministry roles can record elder's assembly attendance
- [ ] Airport pickup/drop-off dates are restricted to the conference windows, including Thursday pickup for all roles
- [ ] Pick-up and/or drop-off selections allow optional hotel/accommodation name and address capture
- [ ] No-op saves do not write empty audits
- [ ] Update notification emails include full registration details and contacts when applicable
- [ ] Update emails include a link that leads to My Registration after login
- [ ] Early bird window and attendee pricing can be changed without redeploy
- [ ] Additional attendees aged 18+ pay the adult rate (early bird when they hold an early-bird place); 12–17, 2–11 and 0–1 use their bands
- [ ] Early-bird capacity counts adults, and only adults covered by payment are confirmed
- [ ] Adults added after the early-bird end date, or when the pool is full, pay the regular rate
- [ ] After the payment due date or when a pool is full, unpaid early-bird adults move to the regular rate automatically, paid adults keep early bird, and the registrant is emailed
- [ ] The review step shows the bulleted Early Bird Registration – Important Reminders with the deadline and regular rate from Registration Settings
- [ ] Adding attendees to a paid registration recalculates the fee and moves the payment status to Part paid
- [ ] Early-bird payment deadline, payment reminders, and registration update recipient can be changed without redeploy
- [ ] Closed registration blocks public/participant registration writes while allowing manager/admin role updates
- [ ] Field help tooltips are available on hover/focus/tap for key registration questions
- [ ] Field help tooltips are never clipped at the screen or card edge on mobile, tablet, laptop, or desktop
- [ ] Elder's assembly checkbox reads "Attending the elder's assembly on Friday, 9 April 2027"

## Related specs

- `features.dashboard`
- `features.payment`
- `features.registration-complete`
- `features.my-registration`
- `global.database`
