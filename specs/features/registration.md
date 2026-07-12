---
id: features.registration
title: Registration form
status: active
synced_commit: working-tree
synced_at: 2026-07-13
owners: [team]
files:
  - src/app/page.tsx
  - src/app/register/page.tsx
  - src/components/registrations/registration-form.tsx
  - src/components/registrations/registration-review-summary.tsx
  - src/components/registrations/transport-schedule-alert.tsx
  - src/lib/registrations/schema.ts
  - src/lib/registrations/transport.ts
  - src/lib/registrations/email-unique.ts
  - src/lib/registrations/service.ts
  - src/lib/registrations/view-token.ts
  - src/lib/registrations/rate-limit.ts
  - src/app/api/registrations/route.ts
  - src/app/api/registrations/[id]/route.ts
  - src/app/api/registrations/check-email/route.ts
  - src/lib/email/send.ts
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
  4. Review & submit
- Short intro: fill in the form, then press Submit once at the bottom.
- Required fields marked with `*`; selects use plain-language placeholders.
- Controls use comfortable sizing (`text-base` / taller inputs) for readability and touch.

### Accessibility

- Semantic `fieldset` + `legend` (or equivalent section headings) per block.
- Error summary at top with `role="alert"` / `aria-live`; on failed submit, focus moves to the first invalid field.
- Labels associated with inputs; checkboxes have accessible names.
- Login link for people who already registered.

### Guest (not logged in)

- ?Already registered? Login? ? `/login?redirect=/my-registration`.
- Email uniqueness checked on email blur and on submit (`/api/registrations/check-email`).
- If email already used: error + **Login here** (`EMAIL_IN_USE` / 409).
- Accommodation and airport transport have **no default**; both required on submit.
- Selecting accommodation `own` / `billet` and transport options shows plain-language info alerts.
- Submit ? public `POST /api/registrations` with `submit: true` ? confirmation email ? `/register/complete?token=&view=`.

### Logged in

- Load via `authFetch`; submit saves and goes to `/my-registration`.
- After prior submit, primary button is **Submit Changes**.

### API

- Public POST: rate-limited; assigns `registration_no`, `participant_reference`, view/signup tokens; `user_id` null.
- Authenticated PUT for edits.
- Unique email: DB index + app checks.

## Acceptance criteria

- [ ] Registration is one scrollable page (no step tabs / Next wizard)
- [ ] Guest can register without an account
- [ ] Duplicate email blocked with login prompt
- [ ] Accommodation and transport mandatory with no pre-selected value
- [ ] Submit focuses first error when validation fails
- [ ] Confirmation email includes details + `/r/{token}` link

## Related specs

- `features.registration-complete`
- `features.magic-link-view`
- `features.home`
- `features.login`
- `global.database`
