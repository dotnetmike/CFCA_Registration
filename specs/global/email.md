---
id: global.email
title: Branded transactional email
status: active
synced_commit: working-tree
synced_at: 2026-10-26
owners: [team]
files:
  - src/lib/email/template.ts
  - src/lib/email/provider.ts
  - src/lib/email/send.ts
  - src/lib/email/send.test.ts
  - src/lib/email/password-reset.ts
  - src/lib/support/contact.ts
  - src/lib/pricing/early-bird.ts
  - src/lib/site-url.ts
  - public/brand/cfca-logo-official.jpg
  - scripts/email/send-sample-emails.ts
---

# Branded transactional email

## Purpose

All outbound transactional emails use a shared Couples for Christ Australia HTML template (logo + blue accent) with a plain-text fallback. Delivery is via a pluggable provider.

## Behavior

- Shared renderer: `src/lib/email/template.ts` (`renderEmail`, `escapeHtml`, `paragraphHtml`, `assertEmailIncludesLogo`).
- Shared transport: `src/lib/email/provider.ts` (`sendTransactionalEmail`) selected by `EMAIL_PROVIDER`.
- **Default provider**: `resend` (Resend API). Requires `RESEND_API_KEY`. From address comes from `EMAIL_FROM` (Resend only).
- **Alternate provider**: `office365` (Microsoft Graph MIME `users/{mailbox}/sendMail` with client-credentials OAuth). Requires `OFFICE365_TENANT_ID`, `OFFICE365_CLIENT_ID`, `OFFICE365_CLIENT_SECRET`, and `OFFICE365_USERNAME`. Optional `OFFICE365_FROM_NAME` sets the From display name (e.g. `CFCA National Conference 2027`); otherwise Entra `displayName` is used when readable. `EMAIL_FROM` is ignored. Does not use SMTP or app passwords (compatible with Security Defaults).
- Logo is embedded as an **inline CID attachment** (`cid:cfca-logo` → `public/brand/cfca-logo-official.jpg`) so it renders without needing a public logo URL.
- Absolute links (View registration, portal, password reset) use `getRequestSiteUrl(request)` from the incoming request `Host` / `X-Forwarded-Host` + `X-Forwarded-Proto`. They are **not** driven by `NEXT_PUBLIC_SITE_URL`.
- Registration / payment emails (`send.ts`) and password reset (`password-reset.ts`) send `html` + `text` (Resend) or HTML with inline logo (Graph) and attach the logo.
- `assertEmailIncludesLogo` runs before send and throws if the HTML omits the logo reference.
- **Email copies**: every registrant email from `send.ts` is BCC'd to the Registration Settings email copy recipient (`notification_recipient_email`) when set. Password reset emails are never copied (they contain a sign-in link).
- When the active provider’s credentials are missing, sends are logged to the console (dev) and still recorded in `email_log` when applicable.
- HTML uses table layout + inline styles; user-controlled strings are escaped.
- **Support contacts** (same addresses, subjects and labels as the registration details page — `src/lib/support/contact.ts`): every registrant email from `send.ts` includes `mailto:` links whose subject names the registration (`<topic> — <Registration No> (<Unique Code>)`) and whose body lists Registration No, Unique Code and name. Each link has an envelope icon (✉, forced to text style) before the label.
  - **Ask about conference payment** (`payment@cfcanatcon.com`): bottom of the Payment summary in the details card (registration submitted / updated / accommodation updated), and under the Payment section in payment received / payment reminder.
  - **Ask about accommodation or transport** (`accomodation@cfcanatcon.com`): under the Accommodation & Transport section (registration submitted / updated / accommodation updated).
  - **Need help?** box after the main call-to-action in every registrant email, with the shared help text and an outlined **Ask a question** button (`support@cfcanatcon.com`).
  - Plain-text bodies list the same contacts as `<label>: email <address>`.
- **Early Bird Registration – Important Reminders** (amber callout with a bold title and a bulleted list, `remindersCalloutHtml`; items from `earlyBirdReminders`, wording in `features.payment`): shown while early-bird adults on the registration are not covered by payment and the early-bird payment due date has not passed — inside the details-card Payment summary of registration submitted / updated / accommodation updated emails (under the reserved-registration helper, above the bank transfer callout) and in the payment reminder intro. Bullets: Limited slots, Payment required, Deadline (payment due date from settings), Unpaid registrations (regular adult rate from settings). Plain-text bodies include it as a `EARLY BIRD REGISTRATION – IMPORTANT REMINDERS` line followed by one `- <Label>: <text>` line per bullet. `sendRegistrationEmail` reads runtime pricing settings for this. The Early Bird pricing update email does not include it.
- **Early Bird pricing update** email (`early_bird_pricing_updated`, sent by the daily payment cron's early-bird expiry when the fee changed; logged in `email_log` as `registration_updated` because `email_type` is a DB enum):
  - Subject: `2027 CFCA National Conference Registration Fee Updated (Early Bird) — <Unique Code>`; heading **Registration fee updated**.
  - Explains why: payment for N adults was not received by the payment due date, **or** early-bird places for Victorian / interstate delegates have been filled by paid registrations; and how many adults already covered by payment keep the early-bird rate.
  - **Fee update** section: Previous registration fee, New registration fee, Amount paid, Balance due (when owed), Unique Code, then the payment support link. When a balance is due: a pay-the-balance line and the bank transfer callout. CTA **Open my registration** (`/my-registration`, login), Need help? box.
- `buildRegistrationEmail` builds subject / text / HTML without sending (optional `pricing` and `earlyBirdChange`); `sendRegistrationEmail` wraps it (recipient, BCC copy, `email_log`).
- **Sample emails for review**: `npm run email:samples -- --registration <No> --to <address> --site-url <public origin>` sends one `[SAMPLE]` copy of each of the five registrant emails using that registration's data and current pricing settings, plus two **Early Bird pricing update** samples (payment due date passed / places filled) simulated in memory when the registration has unpaid early-bird adults. It is read-only (no `email_log` row, no new view token, no fee change), sends only to `--to` (no BCC), and uses a placeholder view token, so View registration / Pay links in samples do not open the registration.

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
- [ ] Every registrant email (registration, payment received, reminders, resends) is BCC'd to the configured copy recipient; password reset emails are not
- [ ] Every registrant email has a Need help? box (support@) and an Ask about conference payment link (payment@), each with an envelope icon and a subject naming the registration
- [ ] Registration submitted / updated / accommodation updated emails also have an Ask about accommodation or transport link (accomodation@) under Accommodation & Transport
- [ ] Sample emails can be sent to one reviewer address without writing to the database or copying anyone else
- [ ] Registration emails and payment reminders show the amber bulleted "Early Bird Registration – Important Reminders" callout only while early-bird adults are unpaid and the due date has not passed
- [ ] Registrants whose early-bird pricing is removed by the daily cron receive an Early Bird pricing update email with the reason and previous / new fee

## Related specs

- `global.theme-and-styles`
- `features.registration`
- `features.payment`
- `features.password-reset`
