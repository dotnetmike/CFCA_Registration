---
id: features.magic-link-view
title: Magic-link registration view
status: active
synced_commit: working-tree
synced_at: 2026-10-24
owners: [team]
files:
  - src/app/r/[token]/page.tsx
  - src/components/registrations/registration-details-view.tsx
  - src/components/support/support-links.tsx
  - src/lib/support/contact.ts
  - src/app/api/registrations/view/[token]/route.ts
  - src/lib/registrations/view-token.ts
  - src/lib/site-url.ts
  - src/lib/email/send.ts
  - src/app/register/pay/page.tsx
  - src/components/payments/payment-step.tsx
  - src/components/payments/stripe-checkout-return.tsx
---

# Magic-link registration view

## Purpose

Permanent read-only view of a registration from the confirmation email, without login.

## Behavior

- Confirmation email “View registration” link is absolute and uses the request host (`getRequestSiteUrl`).
- Route: `/r/[token]` (public).
- Loads via `GET /api/registrations/view/[token]` (hashed token lookup).
- Shows personal, spouse/attendees, accommodation/transport, payment summary.
- Accommodation/transport summary includes hotel/accommodation name and address when provided.
- Edit CTA: if `hasAccount` �?login redirect to `/register`; else signup with email + redirect `/register`.
- Editing always requires an account; magic link never allows registration edits.
- **Layout:** one main card — header with title **Registration details**, subtitle (“Review your registration and complete payment to confirm your attendance.” when a balance is due), and the Payment status badge (top right). On this page only, `pending` shows as an amber **Payment pending** pill with a clock icon (`#FEF3C7` / `#92400E`); other statuses use the shared badge. Body has two columns on large screens (stacked on smaller): left **Registration information** (label/value rows: muted 14px labels `#64748B`, 15–16px values `#172033` — same labels as the original registration emails: Registration No, Name, Email, Mobile, Conference State, Ministry, Ministry Role, Elder's assembly (when attending), Address (line 1, line 2, suburb, state, postcode; always shown, “—” when not provided), Spouse attending / name / email / mobile / dietary requirements, Dietary requirements) with the **Unique Code** badge + copy button below; right the **Payment summary** card. Below: secure-link notice, **Other people attending** and **Accommodation & transport** cards, then edit/home actions.
- **Pay balance due:** payment summary uses the canonical wording in `features.payment`. When the registration is submitted and balance due > 0, the summary shows: helper text “Your registration is reserved. Complete payment to confirm your attendance.”, full-width **Pay $X securely** (lock icon, loading “Opening payment...”) → `/register/pay?view=<token>` (where Online / Bank are chosen), plus “Secure payment · Confirmation emailed after payment”. There is no separate bank-transfer text link. When online payment is unavailable (workflow V1 or Stripe off, per `GET /api/registration-settings`) the button reads **View bank transfer details**. The layout is the shared `RegistrationDetailsView` component, also used by My Registration (`features.my-registration`); its styles are local to that component (no global theme change).
  - Pay page in this mode (view token only, no signup token) is labelled “Registration payment” (not “Step 2 of 3”), offers the same Online (V2 + Stripe) / Bank options, and links back to the registration details.
  - Stripe Checkout success returns to `/r/<token>?payment=success&session_id=…`, which shows the checkout outcome (`StripeCheckoutReturn`, retry → pay page) and reloads the registration once confirmed. Bank “continue” returns to `/r/<token>`. Cancel returns to the pay page.
  - Fully paid registrations show no pay button.
- **Card headings:** **Payment summary** title in brand blue (`#1E5AA8`, uppercase). **Other people attending** (people icon) and **Accommodation & transport** (bed icon) cards have an icon + bold 16px title header with a divider below.
- **Support contacts** (`src/lib/support/contact.ts`, `SupportLink` / `NeedHelpCard` in `src/components/support/support-links.tsx`): each opens the visitor's email app (`mailto:`) with a subject naming their registration — `<topic> — <Registration No> (<Unique Code>)` — and a body listing Registration No, Unique Code and name. The two inline support links and the **Ask a question** button show a mail (envelope) icon before the label so it is clear they open an email. Always shown, whether or not money is owed:
  - **Ask about conference payment** link inside the Payment summary card → `payment@cfcanatcon.com`, subject “Conference payment question — …”.
  - **Need help?** card under the Payment summary (“Ask the organising team about payment, accommodation, hotels or transportation.”) with an **Ask a question** button → `support@cfcanatcon.com`, subject “Question about my registration — …”.
  - **Ask about accommodation or transport** link at the bottom of the Accommodation & transport card → `accomodation@cfcanatcon.com`, subject “Accommodation / transport question — …”.
  - The registrant emails carry the same support contacts (see `global.email`).

## Acceptance criteria

- [ ] Invalid token shows error
- [ ] Page is read-only
- [ ] Edit path requires auth
- [ ] Balance due shown with a Pay button only when a submitted registration has a balance due
- [ ] Paying from the view link returns to the view page with the payment outcome
- [ ] Need help (support@), payment (payment@) and accommodation (accomodation@) links open an email with the registration number and Unique Code in the subject

## Related specs

- `features.registration`
- `features.signup`
- `features.login`
