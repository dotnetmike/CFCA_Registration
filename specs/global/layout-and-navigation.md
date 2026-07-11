---
id: global.layout-and-navigation
title: Layout and navigation
status: active
synced_commit: working-tree
synced_at: 2026-07-11
owners: [team]
files:
  - src/app/layout.tsx
  - src/components/layout/site-header.tsx
  - src/components/auth/require-auth.tsx
  - src/lib/auth/paths.ts
  - src/middleware.ts
---

# Layout and navigation

## Purpose

Shell of every page: header, main content width, and which routes require login.

## Behavior

- Root layout wraps all pages with `AuthProvider`, `SiteHeader`, and `<main className="mx-auto max-w-6xl px-4 py-8">`.
- `RequireAuth` gates **protected** routes only (see `isProtectedPath`).
- **Protected paths**: `/my-registration`, `/payment`, `/dashboard`, `/account` (and subpaths).
- **Public paths** (examples): `/`, `/register`, `/register/complete`, `/r/[token]`, `/login`, `/signup`, `/forgot-password`, `/reset-password`.
- Header when logged out: Login, Sign Up.
- Header when logged in: My Registration, Payment, Account, Dashboard (managers), name, Logout.
- There is **no** â€œRegisterâ€?nav item; entry is Home â†?Register Now â†?`/register`.

## Acceptance criteria

- [ ] Unauthenticated users cannot open protected pages (middleware + RequireAuth)
- [ ] Logged-in header never shows Register
- [ ] Brand link goes to `/`

## Related specs

- `global.auth-security`
- `features.home`
