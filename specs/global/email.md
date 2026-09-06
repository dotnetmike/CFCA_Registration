---
id: global.email
title: Branded transactional email
status: active
synced_commit: working-tree
synced_at: 2026-09-07
owners: [team]
files:
  - src/lib/email/template.ts
  - src/lib/email/provider.ts
  - src/lib/email/send.ts
  - src/lib/email/password-reset.ts
  - src/lib/site-url.ts
  - public/brand/cfca-logo-official.jpg
---

# Branded transactional email

## Purpose

All outbound transactional emails use a shared Couples for Christ Australia HTML template (logo + blue accent) with a plain-text fallback. Delivery is via a pluggable provider.

## Behavior

- Shared renderer: `src/lib/email/template.ts` (`renderEmail`, `escapeHtml`, `paragraphHtml`, `assertEmailIncludesLogo`).
- Shared transport: `src/lib/email/provider.ts` (`sendTransactionalEmail`) selected by `EMAIL_PROVIDER`.
- **Default provider**: `resend` (Resend API). Requires `RESEND_API_KEY`. From address comes from `EMAIL_FROM` (Resend only).
- **Alternate provider**: `office365` (Microsoft Graph MIME `users/{mailbox}/sendMail` with client-credentials OAuth). Requires `OFFICE365_TENANT_ID`, `OFFICE365_CLIENT_ID`, `OFFICE365_CLIENT_SECRET`, and `OFFICE365_USERNAME`. Optional `OFFICE365_FROM_NAME` sets the From display name (e.g. `CFCA National Conference 2026`); otherwise Entra `displayName` is used when readable. `EMAIL_FROM` is ignored. Does not use SMTP or app passwords (compatible with Security Defaults).
- Logo is embedded as an **inline CID attachment** (`cid:cfca-logo` → `public/brand/cfca-logo-official.jpg`) so it renders without needing a public logo URL.
- Absolute links (View registration, portal, password reset) use `getRequestSiteUrl(request)` from the incoming request `Host` / `X-Forwarded-Host` + `X-Forwarded-Proto`. They are **not** driven by `NEXT_PUBLIC_SITE_URL`.
- Registration / payment emails (`send.ts`) and password reset (`password-reset.ts`) send `html` + `text` (Resend) or HTML with inline logo (Graph) and attach the logo.
- `assertEmailIncludesLogo` runs before send and throws if the HTML omits the logo reference.
- When the active provider’s credentials are missing, sends are logged to the console (dev) and still recorded in `email_log` when applicable.
- HTML uses table layout + inline styles; user-controlled strings are escaped.

## Acceptance criteria

- [ ] Every transactional email HTML references `cid:cfca-logo`
- [ ] Sends include the official logo image as an inline attachment
- [ ] Plain-text body remains available as a fallback (Resend); Graph sends HTML body with the same template
- [ ] CTA buttons use brand deep blue (`#0D47A1`)
- [ ] Dynamic content is HTML-escaped
- [ ] View / portal / reset links use the public request host (not localhost) when the request was served on the production domain
- [ ] `EMAIL_PROVIDER=resend` (default) uses Resend; `EMAIL_PROVIDER=office365` uses Microsoft Graph OAuth
- [ ] Switching providers does not change email content/templates
- [ ] Office 365 path does not require disabling Security Defaults or SMTP app passwords

## Related specs

- `global.theme-and-styles`
- `features.registration`
- `features.payment`
- `features.password-reset`
