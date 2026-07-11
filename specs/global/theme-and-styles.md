---
id: global.theme-and-styles
title: Theme and styles
status: active
synced_commit: working-tree
synced_at: 2026-07-11
owners: [team]
files:
  - src/app/globals.css
  - src/app/layout.tsx
  - src/components/ui/button.tsx
  - src/components/ui/card.tsx
  - src/components/ui/input.tsx
  - src/components/ui/label.tsx
  - src/components/ui/alert.tsx
  - postcss.config.mjs
---

# Theme and styles

## Purpose

Define the visual language for CFCA Conference Registration: colors, fonts, Tailwind usage, and shared UI primitives.

## Behavior

- Styling uses **Tailwind CSS v4** via `@import "tailwindcss"` in `globals.css`.
- CSS variables:
  - `--background`: `#f9fafb` (gray-50)
  - `--foreground`: `#111827` (gray-900)
- Fonts: **Geist** (sans) and **Geist Mono** loaded in root layout; applied via `--font-geist-sans` / `--font-geist-mono`.
- Body: `min-h-screen`, `bg-gray-50`, `antialiased`.
- Prefer Tailwind utility classes on elements; avoid new CSS files unless global tokens.
- Shared primitives live under `src/components/ui/` (Button, Card, Input, Label, Alert).
- Primary actions: blue (`bg-blue-600` / `text-blue-600` / `text-blue-700` for brand links).
- Errors: red text / `Alert variant="error"`. Success: `Alert variant="success"`. Info: `Alert variant="info"`.
- No semicolons in TS/TSX (project convention).

## Acceptance criteria

- [ ] New UI uses existing UI components where possible
- [ ] No one-off purple/glow AI-default themes on branded surfaces without an explicit design decision
- [ ] Loading buttons use `isLoading` / `loadingText` / disabled + wait cursor (see front-end Cursor rules)

## Related specs

- `global.layout-and-navigation`
