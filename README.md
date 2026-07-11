# CFCA Conference Registration

Next.js app for CFCA conference registration, payments, and staff dashboard.

## Spec-driven development

**Specs are the source of truth** for product behavior. Keep them in sync with code.

| Doc | Purpose |
|-----|---------|
| [specs/README.md](./specs/README.md) | How the team works with specs |
| [specs/INDEX.md](./specs/INDEX.md) | Catalog of all specs |
| [specs/_meta/SYNC-PROTOCOL.md](./specs/_meta/SYNC-PROTOCOL.md) | Sync rules + commit hashes |

**Workflow**

1. Find or create a spec under `specs/global/` or `specs/features/`.
2. Update the spec for the intended behavior.
3. Implement code to match.
4. After commit: `npm run specs:stamp` to write `synced_commit` / `synced_at`.

In Cursor, ask the agent to read specs first, e.g. *“Follow specs/features/registration.md”* or *“Update the payment spec from the current code”*.

## Getting started

```bash
# Install
npm install

# Copy env and fill secrets
cp .env.example .env

# Apply DB migrations + start Next.js (dev)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Useful scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Deploy pending migrations + `next dev` |
| `npm run build` | Production build |
| `npm run start` | Deploy migrations + `next start` (rebuild after code changes!) |
| `npm run db:deploy` | Migrations / admin seed only |
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
src/app/         Pages + API routes
src/components/  UI + feature components
src/lib/         Auth, registrations, email, audit, db
supabase/        SQL migrations
.cursor/rules/   Cursor AI rules (incl. spec-driven)
```

## Learn more

- [Next.js docs](https://nextjs.org/docs)
- Repo agent notes: [AGENTS.md](./AGENTS.md)
