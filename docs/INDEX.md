# Documentation catalog

`synced_at: working-tree` — refresh when architecture or major flows change.

## Onboarding

| Doc | Audience | Purpose |
|-----|----------|---------|
| [onboarding/01-welcome.md](./onboarding/01-welcome.md) | All | Big picture, glossary, first day |
| [onboarding/02-first-week.md](./onboarding/02-first-week.md) | All | Hands-on checklist |

## Architecture

| Doc | Purpose |
|-----|---------|
| [architecture/overview.md](./architecture/overview.md) | Mind map, C4-style context & containers |
| [architecture/mind-maps.md](./architecture/mind-maps.md) | Product, ownership, and team-loop mind maps |
| [architecture/folder-map.md](./architecture/folder-map.md) | Where code lives; where to change what |
| [architecture/tech-stack.md](./architecture/tech-stack.md) | Stack, env, runtime notes |

## Flows (sequences)

| Doc | Specs |
|-----|-------|
| [flows/auth.md](./flows/auth.md) | `global.auth-security`, `features.login`, `features.signup`, `features.password-reset` |
| [flows/registration.md](./flows/registration.md) | `features.registration`, `features.registration-complete`, `features.magic-link-view` |
| [flows/payment.md](./flows/payment.md) | `features.payment`, payments reconcile in `features.dashboard` |
| [flows/admin-dashboard.md](./flows/admin-dashboard.md) | `features.dashboard`, `features.audit` |

## Data

| Doc | Specs |
|-----|-------|
| [data/model.md](./data/model.md) | `global.database` |
| [data/data-flow.md](./data/data-flow.md) | Cross-cutting |

## Operations & contributing

| Doc | Purpose |
|-----|---------|
| [operations/local-dev.md](./operations/local-dev.md) | Run, build, restart |
| [operations/debugging.md](./operations/debugging.md) | Diagnose issues |
| [operations/migrations.md](./operations/migrations.md) | Schema changes |
| [contributing/add-a-feature.md](./contributing/add-a-feature.md) | Spec → code → docs |
| [contributing/fix-a-bug.md](./contributing/fix-a-bug.md) | Reproduce → fix → verify |
| [contributing/code-conventions.md](./contributing/code-conventions.md) | Patterns used in this repo |

## Meta

| Doc | Purpose |
|-----|---------|
| [README.md](./README.md) | Handbook home |
| [_meta/SYNC-WITH-SPECS.md](./_meta/SYNC-WITH-SPECS.md) | Keep docs ↔ specs ↔ code aligned |
