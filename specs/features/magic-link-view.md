---
id: features.magic-link-view
title: Magic-link registration view
status: active
synced_commit: working-tree
synced_at: 2026-10-08
owners: [team]
files:
  - src/app/r/[token]/page.tsx
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
- **Pay balance due:** payment summary uses the canonical wording in `features.payment` (Payment status badge, Registration fee, Amount paid, Balance due only when > $0). When the registration is submitted and balance due > 0, show a “**Balance due: $X**” callout with a **Pay $X** button → `/register/pay?view=<token>`.
  - Pay page in this mode (view token only, no signup token) is labelled “Registration payment” (not “Step 2 of 3”), offers the same Online (V2 + Stripe) / Bank options, and links back to the registration details.
  - Stripe Checkout success returns to `/r/<token>?payment=success&session_id=…`, which shows the checkout outcome (`StripeCheckoutReturn`, retry → pay page) and reloads the registration once confirmed. Bank “continue” returns to `/r/<token>`. Cancel returns to the pay page.
  - Fully paid registrations show no pay button.

## Acceptance criteria

- [ ] Invalid token shows error
- [ ] Page is read-only
- [ ] Edit path requires auth
- [ ] Balance due shown with a Pay button only when a submitted registration has a balance due
- [ ] Paying from the view link returns to the view page with the payment outcome

## Related specs

- `features.registration`
- `features.signup`
- `features.login`
