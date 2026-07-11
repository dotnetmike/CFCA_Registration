---
id: features.example
title: Example feature
status: draft
synced_commit: working-tree
synced_at: YYYY-MM-DD
owners: [team]
files:
  - path/to/primary-file.tsx
---

# Example feature

## Purpose

One paragraph: what this feature does for the user.

## Behavior

- Bullet the user-visible and API behavior.
- Call out edge cases and errors.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Out of scope

- What this spec does **not** cover.

## Related specs

- `global.auth-security`
- `features.other`

## Notes for Cursor / implementers

- Prefer existing UI components (`Button`, `Card`, `Alert`).
- Loading states: disable triggers + spinner per front-end rules.
