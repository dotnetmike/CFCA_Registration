---
id: features.magic-link-view
title: Magic-link registration view
status: active
synced_commit: 743bec3
synced_at: 2026-08-20
owners: [team]
files:
  - src/app/r/[token]/page.tsx
  - src/app/api/registrations/view/[token]/route.ts
  - src/lib/registrations/view-token.ts
---

# Magic-link registration view

## Purpose

Permanent read-only view of a registration from the confirmation email, without login.

## Behavior

- Route: `/r/[token]` (public).
- Loads via `GET /api/registrations/view/[token]` (hashed token lookup).
- Shows personal, spouse/attendees, accommodation/transport, payment summary.
- Edit CTA: if `hasAccount` �?login redirect to `/register`; else signup with email + redirect `/register`.
- Editing always requires an account; magic link never allows writes.

## Acceptance criteria

- [ ] Invalid token shows error
- [ ] Page is read-only
- [ ] Edit path requires auth

## Related specs

- `features.registration`
- `features.signup`
- `features.login`
