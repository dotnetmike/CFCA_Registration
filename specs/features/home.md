---
id: features.home
title: Home (registration entry)
status: active
synced_commit: 743bec3
synced_at: 2026-08-20
owners: [team]
files:
  - src/app/page.tsx
  - src/app/register/page.tsx
---

# Home (registration entry)

## Purpose

Public entry is the registration form itself (no separate marketing landing).

## Behavior

- `/` renders the multi-step registration form (`RegistrationForm`).
- `/register` redirects to `/` (same form).
- Guests can complete registration without an account.

## Acceptance criteria

- [ ] Unauthenticated users open `/` and see the registration form
- [ ] `/register` redirects to `/`

## Related specs

- `features.registration`
- `global.layout-and-navigation`
