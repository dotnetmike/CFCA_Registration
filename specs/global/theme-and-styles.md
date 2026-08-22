---
id: global.theme-and-styles
title: Theme and styles
status: active
synced_commit: 743bec3
synced_at: 2026-08-20
owners: [team]
files:
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/icon.svg
  - src/app/apple-icon.svg
  - public/brand/
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

Define the visual language for CFCA Conference Registration: Couples for Christ Australia brand blues, fonts, motion, Tailwind usage, shared UI primitives, and logo assets.

## Behavior

- Styling uses **Tailwind CSS v4** via `@import "tailwindcss"` in `globals.css`.
- **Direction**: CFCA brand blue institutional look — deep brand blue (`#0D47A1`), royal/mid blue accents, pale blue mist surfaces, grey secondary text. Not champagne/bronze, not purple, not dark-mode-first.
- CSS variables (see `globals.css`):
  - Brand: `--brand`, `--brand-strong`, `--brand-mid`, `--brand-light`, `--brand-pale`, `--grey`
  - Surfaces: `--background`, `--foreground`, `--ink`, `--mist`, `--surface`, `--line`, `--ring`
  - `--accent` / `--accent-soft` / `--accent-ink` map to the blue brand scale
- Brand assets under `public/brand/`:
  - `cfca-mark.svg`, `cfca-mark-white.svg`, `cfca-logo-horizontal.svg`, `cfca-logo-stacked.svg`, `cfca-logo-official.jpg`
- Favicon / apple icon: `src/app/icon.svg`, `src/app/apple-icon.svg`
- Fonts loaded via CSS `@import` (Cormorant Garamond display, Source Sans 3 body) — not `next/font` at build time.
- Body: atmospheric blue-tint gradient + fine grid texture, `antialiased`, min-height screen.
- Prefer Tailwind utility classes; prefer shared tokens from `@theme` / CSS vars.
- Shared primitives under `src/components/ui/` (Button, Card, Input, Label, Alert) use the brand palette.
- Primary actions: brand blue (`bg-brand`) with darker hover (`bg-brand-strong`).
- Cards used for **interactive form sections** and staff panels only (not decorative marketing cards).
- **Motion** (respect `prefers-reduced-motion`):
  - Page content fade/rise on enter (`.animate-rise`)
  - Button/hover micro interactions (`transition` on color/transform)
  - Form section stagger via `.animate-rise-delay-*`
- Errors / success / info / warning: semantic Alert variants with soft tinted surfaces (not neon).
- No semicolons in TS/TSX (project convention).

## Acceptance criteria

- [ ] New UI uses existing UI components where possible
- [ ] Primary brand color is CFCA deep blue (`#0D47A1`)
- [ ] Loading buttons use `isLoading` / `loadingText` / disabled + wait cursor
- [ ] Favicon shows the CFCA mark
- [ ] Motion is intentional and disabled under reduced-motion preference

## Related specs

- `global.layout-and-navigation`
- `global.email`
- `features.home`
- `features.registration`
- `features.login`
