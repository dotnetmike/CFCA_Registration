---
id: features.signup
title: Signup
status: active
synced_commit: working-tree
synced_at: 2026-07-11
owners: [team]
files:
  - src/app/signup/page.tsx
  - src/app/api/auth/signup/route.ts
  - src/lib/registrations/create-draft.ts
  - src/lib/registrations/view-token.ts
---

# Signup

## Purpose

Create a user account; link an existing guest registration when email matches.

## Behavior

- Fields: name, email, password (min 8).
- Supports `?email=` and `?redirect=` (e.g. from magic-link Edit).
- If unlinked submitted registration exists for email â†?**link** it (do not create second draft).
- Else create draft registration for the new user.
- Default redirect after signup: `/my-registration` (or query redirect).

## Acceptance criteria

- [ ] Duplicate user email returns 409
- [ ] Guest registration with same email is linked on signup

## Related specs

- `features.registration`
- `features.magic-link-view`
- `features.registration-complete`
