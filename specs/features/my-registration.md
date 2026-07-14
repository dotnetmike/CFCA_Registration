---
id: features.my-registration
title: My Registration
status: active
synced_commit: working-tree
synced_at: 2026-07-14
owners: [team]
files:
  - src/app/my-registration/page.tsx
  - src/lib/email/send.ts
---

# My Registration

## Purpose

Logged-in summary of the user’s registration. Primary destination for update-notification email links.

## Behavior

- Protected (`/my-registration`). Unauthenticated visitors are redirected to `/login?redirect=/my-registration`.
- Loads own registration via `GET /api/registrations`.
- Empty ? prompt to start `/` (registration form).
- Shows: Unique Code, amounts (due / paid / remaining), personal summary, spouse flag, attendees.
- **Accommodation & transport** (when applicable):
  - Accommodation type label
  - Accommodation name / address (`hotel_name` / `hotel_address`)
  - Accommodation contact name / phone when set
  - Transport option label
  - Pickup / drop-off flight fields when those flags are set
  - Pickup / drop-off transport contact name / phone when set
- Edit ? `/`. Payment details ? `/payment` when submitted.
- Update emails (`registration_updated`, `accommodation_updated`) link here so participants review the official record after login.

## Acceptance criteria

- [ ] Only the owner’s registration is shown (non-managers)
- [ ] Accommodation and transport contacts/names are visible when present
- [ ] Login redirect returns the user to this page

## Related specs

- `features.registration`
- `features.payment`
- `features.login`
