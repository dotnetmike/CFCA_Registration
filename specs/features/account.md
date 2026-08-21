---
id: features.account
title: Account (change password)
status: active
synced_commit: 743bec3
synced_at: 2026-08-20
owners: [team]
files:
  - src/app/account/page.tsx
  - src/app/api/auth/change-password/route.ts
---

# Account

## Purpose

Logged-in users change their password.

## Behavior

- Protected route `/account`.
- Requires current password + new password (min 8) + confirm.
- Wrong current password �?**400** (not 401) so client does not treat as session expiry.
- Success: revoke other sessions, issue new session cookies, stay logged in.

## Acceptance criteria

- [ ] Wrong current password shows inline error without redirect to login
- [ ] Successful change keeps user authenticated

## Related specs

- `global.auth-security`
