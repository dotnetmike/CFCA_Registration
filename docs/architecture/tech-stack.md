# Tech stack

## Runtime

| Piece | Choice | Notes |
|-------|--------|-------|
| Framework | **Next.js 16** (App Router) | See `AGENTS.md` — read `node_modules/next/dist/docs/` for this version |
| Language | TypeScript | |
| UI | React + Tailwind v4 | CFCA brand blue theme (`globals.css` tokens); Cormorant + Source Sans 3; logos in `public/brand/` |
| DB | Supabase Postgres | Migrations in `supabase/migrations/` |
| Auth | Custom JWT | Cookies `cfca_access_token`, `cfca_refresh_token` |
| Email | Resend | Optional locally if key missing |

## Environment

Branch-specific secrets: see [operations/environments.md](../operations/environments.md).

| Local file | Branch | Notes |
|------------|--------|-------|
| `.env.dev` | `dev` | Separate DEV Supabase project |
| `.env.uat` | `uat` | Separate UAT Supabase project |
| `.env.production` | `master` / `main` | Production Supabase only |

Copy from `.env.<env>.example`. `npm run env:select` (also run by `dev` / `start` / `db:deploy`) writes `.env.local` for Next.js.

Typical keys per env:

- Supabase URL + **service role** key (server only) for **that** project
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / access expiry (unique per env)
- `NEXT_PUBLIC_BANK_*` for payment page
- `RESEND_API_KEY`, `EMAIL_FROM`
- Absolute links in emails use the request Host / `X-Forwarded-*` headers (`getRequestSiteUrl`) — no site URL env var

Never commit secrets. Never expose service role to the client. Never point DEV/UAT at the production Supabase project.

## Scripts

| Command | Use |
|---------|-----|
| `npm run env:select` | Sync `.env.local` from branch / `--env=` |
| `npm run dev` | Select env + migrate + hot reload |
| `npm run build` | Production compile |
| `npm run start` | Select env + migrate + serve **last build** (rebuild after code changes!) |
| `npm run db:deploy` | Select env + migrations / admin seed |
| `npm run specs:stamp` | Stamp spec `synced_commit` to HEAD |

## Versioning

Functional code changes bump `package.json` version (patch/minor/major per team rules in `.cursor/rules`).

## Next.js caveat

This project’s Next.js may differ from training data. Prefer in-repo docs under `node_modules/next/dist/docs/` when APIs look unfamiliar.
