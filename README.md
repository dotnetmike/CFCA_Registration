# CFCA Conference Registration

Next.js app for CFCA conference registration, payments, and staff dashboard.

## Spec-driven development

**Specs are the source of truth** for product behavior. Keep them in sync with code.

| Doc | Purpose |
|-----|---------|
| [specs/README.md](./specs/README.md) | How the team works with specs |
| [specs/INDEX.md](./specs/INDEX.md) | Catalog of all specs |
| [specs/_meta/SYNC-PROTOCOL.md](./specs/_meta/SYNC-PROTOCOL.md) | Sync rules + commit hashes |
| [docs/README.md](./docs/README.md) | Engineering handbook (architecture, flows, ops) |
| [docs/_meta/SYNC-WITH-SPECS.md](./docs/_meta/SYNC-WITH-SPECS.md) | Keep docs ↔ specs ↔ code aligned |

**Workflow**

1. Find or create a spec under `specs/global/` or `specs/features/`.
2. Update the spec for the intended behavior.
3. Implement code to match.
4. If sequences or architecture changed, update the matching page under [`docs/`](./docs/).
5. After commit: `npm run specs:stamp` to write `synced_commit` / `synced_at`.

In Cursor, ask the agent to read specs first, e.g. *“Follow specs/features/registration.md”* or *“Update the payment spec from the current code”*. New joiners: start at [docs/onboarding/01-welcome.md](./docs/onboarding/01-welcome.md).

## Getting started

```bash
# Install
npm install

# One env file per environment (separate Supabase projects)
cp .env.dev.example .env.dev
cp .env.uat.example .env.uat
cp .env.production.example .env.production
# Fill secrets in each file — see docs/operations/environments.md

# Checkout a branch (dev / uat / master), then:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Startup logs show which `APP_ENV` was selected.

### Useful scripts

| Script | Description |
|--------|-------------|
| `npm run env:select` | Sync `.env.local` from git branch (or `--env=dev\|uat\|production`) |
| `npm run dev` | Select env + deploy pending migrations + `next dev` |
| `npm run dev:dev` / `dev:uat` / `dev:production` | Force an env without changing branch |
| `npm run build` | Production build |
| `npm run start` | Select env + deploy migrations + `next start` (rebuild after code changes!) |
| `npm run db:deploy` | Select env + migrations / admin seed |
| `npm run specs:stamp` | Set all product specs’ `synced_commit` to `HEAD` |

> **Note:** `npm run start` serves the last **build**. After editing source, run `npm run build` then `npm run start`, or use `npm run dev` for hot reload.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Custom JWT auth (cookies + Bearer)
- Supabase Postgres (migrations in `supabase/migrations/`)
- Resend for email (optional in local)

## Project map

```
specs/           Product specs (source of truth)
docs/            Engineering handbook (diagrams, debugging, contributing)
src/app/         Pages + API routes
src/components/  UI + feature components
src/lib/         Auth, registrations, email, audit, db
supabase/        SQL migrations
.cursor/rules/   Cursor AI rules (spec-driven + system docs)
```

## Learn more

- [System documentation](./docs/README.md) — mind maps, sequences, data model, how to change the system
- [Next.js docs](https://nextjs.org/docs)
- Repo agent notes: [AGENTS.md](./AGENTS.md)
