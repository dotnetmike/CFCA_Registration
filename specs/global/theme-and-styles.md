---
id: global.theme-and-styles
title: Theme and styles
status: active
synced_commit: working-tree
synced_at: 2026-07-14
owners: [team]
files:
  - src/app/globals.css
  - src/app/layout.tsx
  - src/components/ui/button.tsx
  - src/components/ui/card.tsx
  - src/components/ui/input.tsx
  - src/components/ui/label.tsx
  - src/components/ui/alert.tsx
  - src/components/layout/site-header.tsx
  - src/components/layout/dashboard-subnav.tsx
  - postcss.config.mjs
---

# Theme and styles

## Purpose

Define the visual language for CFCA Conference Registration: prestige institutional conference aesthetic, colors, fonts, motion, Tailwind usage, and shared UI primitives.

## Behavior

- Styling uses **Tailwind CSS v4** via `@import "tailwindcss"` in `globals.css`.
- **Direction**: cool institutional prestige — deep ink navy, mist stone surfaces, champagne/bronze accent. Not purple, not cream+terracotta, not dark-mode-first.
- CSS variables (see `globals.css`):
  - `--background`, `--foreground`, `--ink`, `--mist`, `--surface`, `--accent` (champagne), `--accent-ink`, `--line`, `--ring`
- Fonts (root layout):
  - **Display**: Cormorant Garamond (`--font-display`) for brand wordmark and page titles
  - **Sans**: Source Sans 3 (`--font-sans`) for UI, body, forms
  - Mono kept only if needed for codes
- Body: atmospheric background (soft cool gradient + fine grid texture), `antialiased`, min-height screen.
- Prefer Tailwind utility classes; prefer shared tokens from `@theme` / CSS vars.
- Shared primitives under `src/components/ui/` (Button, Card, Input, Label, Alert) reflect the prestige palette.
- Primary actions: ink navy (`bg-ink`) with champagne hover accent on brand links/CTAs as specified in primitives.
- Cards used for **interactive form sections** and staff panels only (not decorative marketing cards).
- **Motion** (respect `prefers-reduced-motion`):
  - Page content fade/rise on enter (`.animate-rise`)
  - Header brand underline / subtle entrance
  - Button/hover micro interactions (`transition` on color/transform)
  - Form section stagger via `.animate-rise-delay-*`
- Errors / success / info / warning: semantic Alert variants with soft tinted surfaces (not neon).
- No semicolons in TS/TSX (project convention).

## Acceptance criteria

- [ ] New UI uses existing UI components where possible
- [ ] No one-off purple/glow default themes on branded surfaces
- [ ] Loading buttons use `isLoading` / `loadingText` / disabled + wait cursor
- [ ] Display type used for brand + major headings; sans for forms
- [ ] Motion is intentional and disabled under reduced-motion preference

## Related specs

- `global.layout-and-navigation`
- `features.home`
- `features.registration`
- `features.login`
