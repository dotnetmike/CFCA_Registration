---
id: features.login
title: Login
status: active
synced_commit: 743bec3
synced_at: 2026-08-20
owners: [team]
files:
  - src/app/login/page.tsx
  - src/app/api/auth/login/route.ts
---

# Login

## Purpose

Authenticate existing users.

## Behavior

- Form: email, password; loading disables submit.
- Link: Forgot password? ? `/forgot-password`.
- Default redirect: `?redirect=` or `/my-registration`.
- Success sets session cookies + client auth state.
- Failed login audited; generic invalid credentials message.
- After password reset success: `?reset=success` shows success alert.
- Footer: **Haven't registered yet? Click here to register** ? `/` (registration form). No public Sign up link.

## Acceptance criteria

- [ ] Valid credentials land on redirect target
- [ ] Invalid credentials do not leak whether email exists beyond generic error
- [ ] Unregistered users are directed to register, not to open signup

## Related specs

- `features.password-reset`
- `features.home`
- `global.auth-security`
