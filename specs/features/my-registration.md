---
id: features.my-registration
title: My Registration
status: active
synced_commit: 743bec3
synced_at: 2026-08-20
owners: [team]
files:
  - src/app/my-registration/page.tsx
  - src/app/api/registrations/route.ts
  - src/lib/registrations/view-token.ts
  - src/lib/email/send.ts
---

# My Registration

## Purpose

Logged-in summary of the user�s registration. Primary destination for update-notification email links.

## Behavior

- Protected (`/my-registration`). Unauthenticated visitors are redirected to `/login?redirect=/my-registration`.
- Loads own registration via `GET /api/registrations`.
- If no registration is linked to the account, `GET /api/registrations` self-heals by looking for a submitted, unlinked registration with a matching email and auto-linking it to the logged-in account before returning it (handles guest submissions made with the same email prior to login/signup).
- Empty ? prompt to start `/` (registration form).
- Shows: Unique Code, amounts (due / paid / remaining), personal summary, primary registrant dietary requirements, spouse details (name, email, mobile, dietary requirements) when attending, attendees.
- **Additional attendees**: name, age, kids supervision required (when set), and dietary requirements (when set) per attendee.
- **Souvenirs**: pre-ordered t-shirt sizes/quantities shown when any souvenir order line has a quantity greater than zero.
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

- [ ] Only the owner�s registration is shown (non-managers)
- [ ] Spouse details (name, email, mobile, dietary requirements) are shown when spouse is attending
- [ ] Primary registrant and attendee dietary requirements are shown when set
- [ ] Kids supervision requirement is shown per attendee when set
- [ ] Souvenir pre-orders are shown when present
- [ ] Accommodation and transport contacts/names are visible when present
- [ ] Login redirect returns the user to this page

## Related specs

- `features.registration`
- `features.payment`
- `features.login`
