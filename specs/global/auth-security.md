---
id: global.auth-security
title: Auth and security
status: active
synced_commit: working-tree
synced_at: 2026-07-15
owners: [team]
files:
  - src/proxy.ts
  - src/lib/auth/paths.ts
  - src/lib/auth/context.tsx
  - src/lib/auth/jwt.ts
  - src/lib/auth/tokens.ts
  - src/lib/auth/cookies.ts
  - src/lib/auth/session.ts
  - src/lib/auth/api.ts
  - src/lib/supabase/admin.ts
  - src/app/api/auth/login/route.ts
  - src/app/api/auth/logout/route.ts
  - src/app/api/auth/refresh/route.ts
  - src/app/api/auth/me/route.ts
---

# Auth and security

## Purpose

Custom JWT auth (not Supabase Auth). Access + refresh cookies; Bearer tokens for API via `authFetch`.

## Behavior

- Access JWT: HS256, `JWT_ACCESS_SECRET`, expiry `JWT_ACCESS_EXPIRY` (default 6h).
- Refresh token: httpOnly cookie `cfca_refresh_token`, rotated on refresh; hashed in DB.
- Access cookie: `cfca_access_token` (httpOnly) for proxy checks.
- Proxy (`src/proxy.ts`) verifies access JWT or silent-refreshes; else redirect to `/login?redirect=…`.
- API routes use `requireAuth` (Bearer) + optional `requirePermission`.
- Failed password change must **not** return 401 in a way that triggers session-expiry redirect (use 400 for wrong current password).
- Audit important auth events via `writeAuditLog`.
- **Database exposure:** Postgres RLS is enabled on `public` app tables; `anon`/`authenticated` have no CRUD grants. Only the server **service role** client may query tables. Product authorization is enforced in Next.js APIs, not via broad anon PostgREST access. See `global.database`.

## Acceptance criteria

- [ ] Protected pages redirect to login without valid session
- [ ] `authFetch` attaches Bearer and refreshes on 401 for data APIs
- [ ] Logout clears session cookies
- [ ] Publishable/anon key cannot CRUD app data via Supabase REST

## Related specs

- `global.database`
- `features.login`
- `features.signup`
- `features.password-reset`
- `features.account`
- `features.audit`
