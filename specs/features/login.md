---
id: features.login
title: Login
status: active
synced_commit: working-tree
synced_at: 2026-07-11
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
- Link: Forgot password? â†?`/forgot-password`.
- Default redirect: `?redirect=` or `/my-registration`.
- Success sets session cookies + client auth state.
- Failed login audited; generic invalid credentials message.
- After password reset success: `?reset=success` shows success alert.

## Acceptance criteria

- [ ] Valid credentials land on redirect target
- [ ] Invalid credentials do not leak whether email exists beyond generic error

## Related specs

- `features.password-reset`
- `global.auth-security`
