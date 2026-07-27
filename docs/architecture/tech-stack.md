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

Copy `.env.example` → `.env`. Typical needs:

- Supabase URL + **service role** key (server only)
- `JWT_SECRET` / access expiry
- `NEXT_PUBLIC_BANK_*` for payment page
- `RESEND_API_KEY`, `EMAIL_FROM`
- Site URL helper for magic links (`getSiteUrl`)

Never commit secrets. Never expose service role to the client.

## Scripts

| Command | Use |
|---------|-----|
| `npm run dev` | Migrate + hot reload |
| `npm run build` | Production compile |
| `npm run start` | Migrate + serve **last build** (rebuild after code changes!) |
| `npm run db:deploy` | Migrations / admin seed only |
| `npm run specs:stamp` | Stamp spec `synced_commit` to HEAD |

## Versioning

Functional code changes bump `package.json` version (patch/minor/major per team rules in `.cursor/rules`).

## Next.js caveat

This project’s Next.js may differ from training data. Prefer in-repo docs under `node_modules/next/dist/docs/` when APIs look unfamiliar.
