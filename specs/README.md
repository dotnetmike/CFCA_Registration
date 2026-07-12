# Spec-driven development

This project is **spec-driven**. Specs in [`specs/`](./) are the source of truth for intended behavior. Code and specs must stay in sync.

## Quick start for developers

1. Read this file and [`SYNC-PROTOCOL.md`](./_meta/SYNC-PROTOCOL.md).
2. Before changing a feature, open the matching spec under [`features/`](./features/) or [`global/`](./global/).
3. Update the **spec first** (or in the same PR as code).
4. Implement or adjust code to match.
5. Update the spec’s `synced_commit` / file list (or run `npm run specs:stamp` after commit).
6. In Cursor, say e.g. *“Sync registration from specs”* or *“Update specs from code for payment”*.

## Folder layout

```
specs/
  README.md                 ← you are here
  INDEX.md                  ← catalog of all specs
  _meta/
    TEMPLATE.md             ← copy for new specs
    SYNC-PROTOCOL.md        ← how sync + commit hashes work
  global/                   ← cross-cutting (theme, layout, auth, DB)
  features/                 ← one area per product flow
```

| Area | Purpose |
|------|---------|
| **global/** | Theme, layout, CSS, auth/security, database conventions |
| **features/** | Login, signup, registration, payment, dashboard, etc. |
| **_meta/** | Templates and process docs (not product behavior) |

## Spec frontmatter (required)

Every product spec starts with:

```yaml
---
id: features.registration
title: Registration
status: active
synced_commit: b13ac5b
synced_at: 2026-07-11
owners: [team]
files:
  - src/components/registrations/registration-form.tsx
---
```

- **`synced_commit`**: short git SHA of the commit that last verified this spec against code. Use `working-tree` only while changes are uncommitted.
- **`files`**: paths this spec owns. Cursor and humans use this list for sync checks.

## Engineering handbook

Architecture, sequence diagrams, data model, debugging, and contributing guides live in [`docs/`](../docs/README.md). They **link** to specs and must stay in sync with code — see [`docs/_meta/SYNC-WITH-SPECS.md`](../docs/_meta/SYNC-WITH-SPECS.md).

## Cursor AI expectations

When you prompt Cursor on this repo:

1. **Read relevant specs first** (INDEX → feature/global).
2. If the user asks for a product change → **update spec, then code**.
3. If code was changed manually → **update the matching spec** (behavior + `files` + `synced_commit`).
4. If architecture or flows changed → update matching pages under `docs/`.
5. Do not leave specs and code disagreeing.

See [`.cursor/rules/spec-driven-development.mdc`](../.cursor/rules/spec-driven-development.mdc) and [`.cursor/rules/system-documentation.mdc`](../.cursor/rules/system-documentation.mdc).

## Adding a new feature

1. Copy [`_meta/TEMPLATE.md`](./_meta/TEMPLATE.md) to `features/<name>.md`.
2. Fill behavior, acceptance criteria, and `files`.
3. Add a row to [`INDEX.md`](./INDEX.md).
4. Implement code.
5. Stamp commit after merge: `npm run specs:stamp`.

## Small-team tips

- Prefer **one spec per user-facing flow** (login, registration), not one file per component.
- Put shared UI rules in **global**, not copy-pasted into every feature.
- Keep specs short: behavior + acceptance + file list. Link to code instead of pasting large snippets.
- Review specs in PRs the same way you review code.
