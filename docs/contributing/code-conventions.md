# Code conventions

Align with existing code and Cursor rules (front-end, spec-driven, Supabase). Prefer matching neighbors over introducing a new style.

## TypeScript / React

- Prefer `const handleX = () => {}` for event handlers.
- Early returns over deep nesting.
- No semicolons (project style).
- Tailwind for styling; follow existing layout/theme specs (`global.theme-and-styles`, `global.layout-and-navigation`).
- Accessibility: labels, keyboard handlers, `aria-*` where interactive.

## Interaction (mandatory)

Every user-initiated async action:

1. Set loading state immediately.
2. `disabled={isLoading}` on the trigger.
3. Spinner / “Submitting…” label + `disabled:cursor-not-allowed` / `cursor-wait`.

## API routes

- Validate input (Zod) at the boundary.
- Auth: session helpers + permission checks used elsewhere.
- Return clear JSON errors; avoid leaking internals.
- Audit mutations that change meaningful data; skip no-ops.

## Domain logic

- Put reusable rules in `src/lib/<domain>/`, not only in page components.
- Registration field mapping: keep form ↔ DB mapping centralized (`mapFormToDb` / compare snapshots).
- Pricing and souvenirs: do not hardcode fee math in random UI files.

## Database

- Numbered migrations only; see [migrations.md](../operations/migrations.md).
- Server uses Supabase **service role** client for privileged writes.
- Never commit secrets (`.env`).

## Specs & docs

- Product behavior → `specs/`.
- Architecture / sequences / ops → `docs/`.
- Do not duplicate acceptance criteria in docs; **link** the spec.

## Versioning

Functional code changes bump `package.json` (patch default; minor for features; major for breaking).

## Next.js note

This repo uses a Next.js version that may differ from older tutorials. Prefer `node_modules/next/dist/docs/` and [AGENTS.md](../../AGENTS.md) over outdated App Router habits.
