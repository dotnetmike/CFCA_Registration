# First-week checklist

Use this after [01-welcome.md](./01-welcome.md).

## Day 1–2 — Run & explore

- [ ] `npm install`, copy `.env.example` → `.env`, fill Supabase + JWT secrets
- [ ] `npm run dev` — confirm migrations apply
- [ ] Guest registration end-to-end (including optional souvenir)
- [ ] Create account from complete page / magic-link flow
- [ ] Pay screen shows Unique Code + remaining balance
- [ ] Manager: dashboard filters, detail edit warning/confirm, admin notes, audit log

## Day 3 — Specs & docs discipline

- [ ] Read `specs/README.md` and `specs/_meta/SYNC-PROTOCOL.md`
- [ ] Read `docs/_meta/SYNC-WITH-SPECS.md`
- [ ] Pick one feature; open its spec; find every path in `files:`
- [ ] Trace one API call from UI → `src/app/api/...` → `src/lib/...` → DB

## Day 4 — Make a small change safely

Follow [../contributing/add-a-feature.md](../contributing/add-a-feature.md) for a tiny task (e.g. copy tweak):

1. Update spec
2. Change code
3. Update flow doc if UX path changed
4. Build / restart if using `npm run start`
5. Patch version in `package.json` for functional changes

## Day 5 — Debug practice

- [ ] Reproduce a failed login (wrong password) — find audit action
- [ ] Force a validation error on registration — confirm focus / alert behavior
- [ ] Open [../operations/debugging.md](../operations/debugging.md) and bookmark it

## Senior track (same week)

- [ ] Review permission matrix in `src/lib/auth/permissions.ts` + migration `001_auth.sql`
- [ ] Walk payment reconcile sequence in [../flows/payment.md](../flows/payment.md)
- [ ] Review no-op save / audit behavior (`src/lib/registrations/compare.ts`, PUT `[id]`)
- [ ] Note Next.js version quirks in `AGENTS.md` / `node_modules/next/dist/docs/`
