---
id: global.email
title: Branded transactional email
status: active
synced_commit: working-tree
synced_at: 2026-08-22
owners: [team]
files:
  - src/lib/email/template.ts
  - src/lib/email/send.ts
  - src/lib/email/password-reset.ts
  - src/lib/site-url.ts
  - public/brand/cfca-logo-official.jpg
---

# Branded transactional email

## Purpose

All outbound Resend emails use a shared Couples for Christ Australia HTML template (logo + blue accent) with a plain-text fallback.

## Behavior

- Shared renderer: `src/lib/email/template.ts` (`renderEmail`, `escapeHtml`, `paragraphHtml`, `assertEmailIncludesLogo`).
- Logo is embedded as an **inline CID attachment** (`cid:cfca-logo` → `public/brand/cfca-logo-official.jpg`) so it renders without needing a public logo URL.
- Absolute links (View registration, portal, password reset) use `getRequestSiteUrl(request)` from the incoming request `Host` / `X-Forwarded-Host` + `X-Forwarded-Proto`. They are **not** driven by `NEXT_PUBLIC_SITE_URL`.
- Registration / payment emails (`send.ts`) and password reset (`password-reset.ts`) send `html` + `text` and attach the logo.
- `assertEmailIncludesLogo` runs before send and throws if the HTML omits the logo reference.
- Without `RESEND_API_KEY`, sends are logged to the console (dev) and still recorded in `email_log` when applicable.
- HTML uses table layout + inline styles; user-controlled strings are escaped.

## Acceptance criteria

- [ ] Every transactional email HTML references `cid:cfca-logo`
- [ ] Sends include the official logo image as an inline attachment
- [ ] Plain-text body remains available as a fallback
- [ ] CTA buttons use brand deep blue (`#0D47A1`)
- [ ] Dynamic content is HTML-escaped
- [ ] View / portal / reset links use the public request host (not localhost) when the request was served on the production domain

## Related specs

- `global.theme-and-styles`
- `features.registration`
- `features.payment`
- `features.password-reset`
