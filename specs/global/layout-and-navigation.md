---
id: global.layout-and-navigation
title: Layout and navigation
status: active
synced_commit: working-tree
synced_at: 2026-07-27
owners: [team]
files:
  - src/app/layout.tsx
  - src/components/layout/site-header.tsx
  - src/components/layout/dashboard-subnav.tsx
  - src/components/auth/require-auth.tsx
  - src/lib/auth/paths.ts
  - src/proxy.ts
  - public/brand/cfca-australia-mark.png
  - public/brand/cfca-logo-horizontal.svg
---

# Layout and navigation

## Purpose

Shell of every page: header, main content width, and which routes require login.

## Behavior

- Root layout wraps all pages with `AuthProvider`, `SiteHeader`, atmospheric body shell, and `<main className="cfca-main …">` (`mx-auto max-w-6xl` content width).
- Header is a white frosted bar with three zones: **left** Australia mark icon + readable “COUPLES FOR CHRIST” / “AUSTRALIA” wordmark (HTML text, not baked into a tiny logo raster), **center** “Conference Registration”, **right** nav actions.
- `RequireAuth` gates **protected** routes only (see `isProtectedPath`).
- **Protected paths**: `/my-registration`, `/payment`, `/dashboard`, `/account` (and subpaths).
- **Public paths** (examples): `/`, `/register` (redirects to `/`), `/register/complete`, `/r/[token]`, `/login`, `/signup` (post-registration only), `/forgot-password`, `/reset-password`.
- Header when logged out: **Login**, **Register** (→ `/`) — except on the registration page (`/` / `/register`), where those links are hidden (visitor is already registering).
- Header when logged in: My Registration, Payment, Account, **Dashboard dropdown** (managers — submenu of staff pages), name, Logout.
- Brand logo link goes to `/` (registration form).
- Staff pages under `/dashboard` also show the shared **DashboardSubnav** bar (see `features.dashboard`).

## Acceptance criteria

- [ ] Unauthenticated users cannot open protected pages (proxy + RequireAuth)
- [ ] Logged-out header shows Login and Register (not Sign Up) on non-registration pages
- [ ] Logged-out header on `/` (registration) hides Login and Register
- [ ] Header left brand uses large Australia icon + readable Couples for Christ / Australia HTML wordmark linking to `/`
- [ ] Header center shows Conference Registration in the brand display font
- [ ] Managers get a Dashboard submenu (header dropdown + in-dashboard subnav)

## Related specs

- `global.auth-security`
- `global.theme-and-styles`
- `features.home`
- `features.login`
- `features.signup`
- `features.dashboard`
