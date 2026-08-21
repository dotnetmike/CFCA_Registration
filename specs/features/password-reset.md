---
id: features.password-reset
title: Password reset
status: active
synced_commit: working-tree
synced_at: 2026-08-22
owners: [team]
files:
  - src/app/forgot-password/page.tsx
  - src/app/reset-password/page.tsx
  - src/app/api/auth/forgot-password/route.ts
  - src/app/api/auth/reset-password/route.ts
  - src/lib/auth/password-reset.ts
  - src/lib/email/password-reset.ts
  - src/lib/site-url.ts
---

# Password reset

## Purpose

Allow users to reset a forgotten password via email link.

## Behavior

- Forgot: always returns generic success message; emails link if account exists.
- Reset link origin comes from the request Host / forwarded headers (`getRequestSiteUrl`), not env config.
- Token stored hashed; expiry via `PASSWORD_RESET_EXPIRY_MINUTES` (default 60).
- Reset: set new password; revoke sessions; redirect login with `reset=success`.

## Acceptance criteria

- [ ] Does not reveal whether email is registered
- [ ] Expired/invalid token rejected
- [ ] Reset link uses the public request host when served on production

## Related specs

- `features.login`
- `global.auth-security`
- `global.email`
