---
id: features.registration
title: Registration form
status: active
synced_commit: working-tree
synced_at: 2026-07-11
owners: [team]
files:
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

Multi-step conference registration. Guests complete without login; logged-in owners can edit.

## Behavior

### Steps

1. Personal â†?2. Attendees â†?3. Transport â†?4. Review

### Guest (not logged in)

- Header: â€œAlready registered? Loginâ€?â†?`/login?redirect=/my-registration`.
- Next validates and advances **in memory** (no draft save).
- Email uniqueness checked on leaving Personal (`/api/registrations/check-email`) and on submit.
- If email already used: error + **Login here** link (`EMAIL_IN_USE` / 409).
- **Accommodation** and **Airport transport** have no default; placeholder â€œSelect â€¦â€? both required before leaving Transport and before submit.
- Selecting accommodation `own` / `billet` shows info alerts; transport `own` shows self-arranged transport note; other transport options show schedule alert.
- Submit â†?public `POST /api/registrations` with `submit: true` â†?confirmation email (full answers + magic link) â†?`/register/complete?token=&view=`.

### Logged in

- Load/save via `authFetch`; draft saves on Next; submit â†?`/my-registration`.
- After submit, step tabs are clickable; primary button becomes **Submit Changes**.

### API

- Public POST: rate-limited; assigns `registration_no`, `participant_reference`, view/signup tokens; `user_id` null.
- Authenticated PUT remains required for edits.
- Unique email: DB index + app checks.

## Acceptance criteria

- [ ] Guest can register without an account
- [ ] Duplicate email blocked with login prompt
- [ ] Accommodation and transport mandatory with no pre-selected value
- [ ] Confirmation email includes details + `/r/{token}` link

## Related specs

- `features.registration-complete`
- `features.magic-link-view`
- `features.login`
- `global.database`
