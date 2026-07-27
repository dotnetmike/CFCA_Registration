# Spec catalog

Use this index to find the right document. Specs are the source of truth; keep `synced_commit` current.

## Global

| ID | Spec | Owns |
|----|------|------|
| `global.theme-and-styles` | [theme-and-styles.md](./global/theme-and-styles.md) | CSS variables, Tailwind usage, fonts, CFCA blue brand |
| `global.layout-and-navigation` | [layout-and-navigation.md](./global/layout-and-navigation.md) | Root layout, header logo, public vs protected nav |
| `global.auth-security` | [auth-security.md](./global/auth-security.md) | JWT, cookies, proxy, protected paths |
| `global.database` | [database.md](./global/database.md) | Migrations, deploy, key tables |
| `global.email` | [email.md](./global/email.md) | Branded HTML + text transactional emails |

## Features

| ID | Spec | Owns |
|----|------|------|
| `features.home` | [home.md](./features/home.md) | `/` is the registration form |
| `features.registration` | [registration.md](./features/registration.md) | Public multi-step form, email uniqueness, transport/accommodation |
| `features.registration-complete` | [registration-complete.md](./features/registration-complete.md) | Congrats + optional account |
| `features.magic-link-view` | [magic-link-view.md](./features/magic-link-view.md) | `/r/[token]` read-only view |
| `features.login` | [login.md](./features/login.md) | Login + forgot-password link |
| `features.signup` | [signup.md](./features/signup.md) | Signup + link guest registration |
| `features.password-reset` | [password-reset.md](./features/password-reset.md) | Forgot / reset password |
| `features.account` | [account.md](./features/account.md) | Change password |
| `features.my-registration` | [my-registration.md](./features/my-registration.md) | Logged-in registration summary |
| `features.payment` | [payment.md](./features/payment.md) | Payment info + mockup |
| `features.dashboard` | [dashboard.md](./features/dashboard.md) | Manager dashboard |
| `features.audit` | [audit.md](./features/audit.md) | Audit log |

## Meta

| Doc | Purpose |
|-----|---------|
| [README.md](./README.md) | How the team works with specs |
| [SYNC-PROTOCOL.md](./_meta/SYNC-PROTOCOL.md) | Sync rules + commit hashes |
| [TEMPLATE.md](./_meta/TEMPLATE.md) | New spec template |
| [../docs/README.md](../docs/README.md) | Engineering handbook (architecture, flows, ops) |
