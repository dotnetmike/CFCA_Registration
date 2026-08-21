---
id: features.registration
title: Registration form
status: active
synced_commit: working-tree
synced_at: 2026-08-21
owners: [team]
files:
  - src/app/page.tsx
  - src/app/register/page.tsx
  - src/components/layout/site-header.tsx
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
  - src/app/api/registrations/route.ts
  - src/app/api/registrations/[id]/route.ts
  - src/app/api/registrations/check-email/route.ts
  - src/lib/email/send.ts
  - supabase/migrations/014_registration_dietary_requirements.sql
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
- Required fields marked with `*`; selects use plain-language placeholders.
- Controls use comfortable sizing (`text-base` / taller inputs) for readability and touch.

### Registration details

- Primary registrant and attendee fields include an optional food allergy and dietary requirements field.
- Australian mobile numbers are validated to the local format (`04xx xxx xxx` or `+61...`).

### Airport transport

- Pickup is available from Friday, 9 April 2027 to Saturday, 10 April 2027, 5am–10pm.
- Drop-off is available from Saturday, 10 April 2027 to Sunday, 11 April 2027, 5am–10pm.
- Pickup exception: Chapter Leader, Ministry Coordinator, Area Coordinator, Area Head, and National Council roles may choose Thursday, 8 April 2027 to Saturday, 10 April 2027, 5am–10pm only.
- On-screen schedule alert copy reflects the selected transport option and CFCA position:
  - Pickup only, standard position: "Pick-up at Tullamarine is available only on Friday, 9 April 2027, 5am–10pm."
  - Pickup only, exception position: "Pick-up at Tullamarine is available from Thursday, 8 April 2027, 5am–10pm."
  - Pickup + drop-off, standard position: "Pick-up and drop-off at Tullamarine: pick-up Friday, 9 April 2027, 5am–10pm and drop-off Sunday, 11 April 2027, 5am–10pm."
  - Pickup + drop-off, exception position: "Pick-up and drop-off at Tullamarine: pick-up from Thursday, 8 April 2027, 5am–10pm and drop-off Sunday, 11 April 2027, 5am–10pm."
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
- Accommodation and airport transport mandatory with no default.
- Submit → public `POST /api/registrations` → `/register/complete`.

### Logged in

- Load/save via `authFetch`; submit → `/my-registration`.
- No-op saves skipped when nothing changed.

### API

- Public POST rate-limited; unique email enforced.
- Authenticated PUT; unchanged payloads return `unchanged: true`.
- Invalid Supabase service-role key surfaces as a configuration error (not a silent email-available success).

### Participant emails (`src/lib/email/send.ts`)

- **Submitted** (`registration_submitted`): full registration summary + magic-link view URL (`/r/{token}`).
- **Updated** (`registration_updated` / `accommodation_updated`): full registration summary including accommodation name/address and accommodation/transport contacts when set; includes a portal link to `/my-registration` (login required via proxy redirect).
- Accommodation/transport contact lines appear only when applicable (values present / transport flags).

## Acceptance criteria

- [ ] Continuous single-page registration
- [ ] Optional t-shirt pre-order with size/qty at $30 each
- [ ] Love In Action proceeds note shown
- [ ] Souvenir total included in amount due
- [ ] National Conference reminder shown as National Conference 2027
- [ ] Food allergy and dietary requirements field is available for registrants, spouses, and attendees
- [ ] Australian mobile validation is enforced
- [ ] Airport pickup/drop-off dates are restricted to the conference windows with the CFCA pickup exception
- [ ] No-op saves do not write empty audits
- [ ] Update notification emails include full registration details and contacts when applicable
- [ ] Update emails include a link that leads to My Registration after login

## Related specs

- `features.dashboard`
- `features.payment`
- `features.registration-complete`
- `features.my-registration`
- `global.database`
