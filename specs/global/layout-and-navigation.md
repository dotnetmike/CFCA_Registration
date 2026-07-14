---
id: global.layout-and-navigation
title: Layout and navigation
status: active
synced_commit: working-tree
synced_at: 2026-07-14
owners: [team]
files:
  - src/app/layout.tsx
  - src/components/layout/site-header.tsx
  - src/components/layout/dashboard-subnav.tsx
  - src/components/auth/require-auth.tsx
  - src/lib/auth/paths.ts
  - src/proxy.ts
---

# Layout and navigation

## Purpose

Shell of every page: header, main content width, and which routes require login.

## Behavior

- Root layout wraps all pages with `AuthProvider`, `SiteHeader`, and `<main className="mx-auto max-w-6xl px-4 py-8">`.
- `RequireAuth` gates **protected** routes only (see `isProtectedPath`).
- **Protected paths**: `/my-registration`, `/payment`, `/dashboard`, `/account` (and subpaths).
- **Public paths** (examples): `/`, `/register` (redirects to `/`), `/register/complete`, `/r/[token]`, `/login`, `/signup` (post-registration only), `/forgot-password`, `/reset-password`.
- Header when logged out: **Login**, **Register** (→ `/`).
- Header when logged in: My Registration, Payment, Account, **Dashboard dropdown** (managers — submenu of staff pages), name, Logout.
- Brand link goes to `/` (registration form).
- Staff pages under `/dashboard` also show the shared **DashboardSubnav** bar (see `features.dashboard`).

## Acceptance criteria

- [ ] Unauthenticated users cannot open protected pages (proxy + RequireAuth)
- [ ] Logged-out header shows Login and Register (not Sign Up)
- [ ] Brand link goes to `/`
- [ ] Managers get a Dashboard submenu (header dropdown + in-dashboard subnav)

## Related specs

- `global.auth-security`
- `features.home`
- `features.login`
- `features.signup`
- `features.dashboard`
