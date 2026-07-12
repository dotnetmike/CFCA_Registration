---
id: features.signup
title: Account setup (post-registration)
status: active
synced_commit: working-tree
synced_at: 2026-07-13
owners: [team]
files:
  - src/app/signup/page.tsx
  - src/app/api/auth/signup/route.ts
  - src/app/api/auth/register-signup/route.ts
  - src/lib/registrations/view-token.ts
---

# Account setup (post-registration)

## Purpose

Let people who **already registered** create a password / account to edit later. Not a public ?sign up instead of register? path.

## Behavior

- No standalone open signup in the header.
- `/signup` is allowed when linking context exists: `?email=` (e.g. magic-link Edit) and/or signup token flows from registration complete.
- Without linking context, page explains account setup is only after registration and links to `/`.
- API signup must link an existing registration for the email (do not create a brand-new draft for cold signup).
- Fields: name, email, password (min 8).
- Default redirect: `/my-registration` (or query redirect).

## Acceptance criteria

- [ ] Cold visitors cannot use signup as a substitute for registration
- [ ] Guest registration with same email is linked on account setup
- [ ] Duplicate user email returns 409

## Related specs

- `features.registration`
- `features.registration-complete`
- `features.magic-link-view`
- `features.home`
