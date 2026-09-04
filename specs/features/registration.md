---
id: features.registration
title: Registration form
status: active
synced_commit: working-tree
synced_at: 2026-08-24
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
  4. Souvenir pre-order (optional)
  5. Review & submit
- Short intro: fill in the form, then press Submit once at the bottom.
- National Conference reminder shown on the page: **National Conference 2027**.
- Required fields marked with a prominent **red asterisk**; invalid fields show a red border on submit.
- On submit, **all** validation errors are shown together in a summary list (not one-at-a-time).
- Controls use comfortable sizing (`text-base` / taller inputs) for readability and touch.
- Fields that may need extra explanation show a **help icon** (?) beside the label. Hover or keyboard focus on the icon opens a short tooltip with guidance.
- Multi-column field rows share a consistent label height, control height (`h-12`), and reserved error-message slot so siblings stay aligned (including action buttons such as **Remove**).

### Registration details

- Primary registrant and attendee fields include an optional food allergy and dietary requirements field.
- Australian mobile numbers are validated to the local format (`04xx xxx xxx` or `+61...`).
- Address fields use labels **Address Suburb**, **Address Postcode**, and **Address State** (optional).
- **Ministry** is selected before **Ministry Role**: CFCA, HOLD, SOLD, LIA, Family Ministry, or Non-member. Selecting Non-member locks Ministry Role to Non-member.
- **CFCA Membership State** (required, DB column `state`) is shown on the same row as **Ministry Role** on medium+ screens; on small screens membership state stacks below ministry role.
- When the user selects or changes **Address State** (including via address autocomplete), **CFCA Membership State** is set to the same value automatically.
- Chapter Leader, Ministry Coordinator, Area Coordinator, Area Head, and National Council roles may record elder's assembly attendance on Thursday, 8 April 2027.

### Airport transport

- Pickup is available from Thursday, 8 April 2027 to Saturday, 10 April 2027, 5am–10pm for every ministry role.
- Drop-off is available from Saturday, 10 April 2027 to Sunday, 11 April 2027, 5am–10pm.
- When **Pick-up and/or Drop-off** is selected, users can optionally provide their hotel/accommodation name and address to support transport planning.
  - Pickup only: "Pick-up at Tullamarine is available from Thursday, 8 April 2027, 5am–10pm."
  - Pickup + drop-off: "Pick-up and drop-off at Tullamarine: pick-up from Thursday, 8 April 2027, 5am–10pm and drop-off Sunday, 11 April 2027, 5am–10pm."
  - Drop-off only (any position): "Drop-off at Tullamarine is available only on Sunday, 11 April 2027, 5am–10pm."
  - All variants note transport from other airports (e.g. Avalon) may not be available.
- Spouse records include an optional food allergy and dietary requirements field if attending.

### Souvenir pre-order (optional)

- Managed by **Love In Action**; note that all proceeds support a fund for future projects sharing love and help to others.
- Item: conference **t-shirt**, **$30** each.
- Registrant may pre-order multiple lines by **size** and **quantity** (e.g. 1� Medium + 3� Large).
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
- Submit → public `POST /api/registrations` → `/register/complete`.
- When registration is closed, public submit is blocked with a friendly message to contact Chapter Leaders.

### Logged in

- Load/save via `authFetch`; submit → `/my-registration`.
- No-op saves skipped when nothing changed.
- When registration is closed, owner-level updates are blocked. Admin / Registration Manager / Accommodation Manager can still update registrations.

### Runtime pricing + early bird settings

- Early bird window and attendee pricing are loaded from runtime registration settings (DB-backed), not hardcoded constants.
- Form pricing preview and server-side amount calculations use the same runtime settings.
- The early-bird payment due date, payment reminder dates, and registration-updates recipient are runtime settings. The daily payment cron changes unpaid/part-paid early-bird registrations to regular pricing after the deadline, sends reminders on configured dates, and BCCs new/modified registration emails to the configured address.

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
- [ ] Early-bird payment deadline, payment reminders, and registration update recipient can be changed without redeploy
- [ ] Closed registration blocks public/participant registration writes while allowing manager/admin role updates
- [ ] Field help tooltips are available on hover/focus for key registration questions

## Related specs

- `features.dashboard`
- `features.payment`
- `features.registration-complete`
- `features.my-registration`
- `global.database`
