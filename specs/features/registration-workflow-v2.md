---
id: features.registration-workflow-v2
title: Registration workflow V2 (online payment)
status: active
synced_commit: working-tree
synced_at: 2026-09-27
owners: [team]
files:
  - src/lib/registration-workflow.ts
  - src/lib/stripe/config.ts
  - src/lib/stripe/client.ts
  - src/lib/payments/stripe-ledger.ts
  - src/lib/registration-settings.ts
  - src/app/dashboard/settings/page.tsx
  - src/app/api/admin/registration-settings/route.ts
  - src/app/api/registration-settings/route.ts
  - src/components/registrations/registration-form.tsx
  - src/app/register/pay/page.tsx
  - src/app/payment/page.tsx
  - src/app/register/complete/page.tsx
  - src/components/payments/payment-step.tsx
  - src/components/payments/payment-method-badges.tsx
  - src/components/payments/stripe-checkout-return.tsx
  - src/app/my-registration/page.tsx
  - src/lib/payments/stripe-checkout-session.ts
  - src/app/api/payments/stripe/create-checkout-session/route.ts
  - src/app/api/payments/stripe/webhook/route.ts
  - src/app/api/payments/stripe/status/route.ts
  - supabase/migrations/019_registration_workflow_v2_stripe.sql
---

# Registration workflow V2 (online payment)

## Purpose

Run a pay-step registration flow (V2) side by side with classic bank-after-submit (V1). Admins enable V2 from Dashboard Settings when ready for online payments.

## Behavior

- **V1 (default):** form → Submit Registration → `/register/complete` → bank `/payment` later.
- **V2:** form → Proceed to Payment → `/register/pay` (Bank and/or Online) → `/register/complete`.
- Dashboard **Registration payment workflow** setting: `v1` | `v2` (default `v1`). Changing it writes audit `settings.registration_workflow_changed`.
- Optional env `REGISTRATION_WORKFLOW` overrides DB for local emergency only.
- Preview while V1 is primary: `/register?workflow=v2`.
- V2 Online uses **Stripe Checkout** (hosted prebuilt page) when `STRIPE_SECRET_KEY` is set; otherwise Bank-only on the pay step.
- Stripe configuration is **secret key only** plus a Dashboard webhook URL (`/api/payments/stripe/webhook`). No publishable key or webhook signing secret. The webhook re-fetches each event from Stripe by id before acting.
- Online Payment creates a Checkout Session and redirects the participant to Stripe; card data never touches our servers.
- Remaining balance after edits uses the active workflow (V2 Online when enabled + keys).
- Webhook `checkout.session.completed` is source of truth for online success; success page may call status recovery with `session_id` if the webhook lagged.
- Amounts always from server `amount_due - amount_paid`. Ledger remains idempotent by PaymentIntent id.

### Pay step layout (`/register/pay`, and `/payment` when V2)

1. **Payment method** radio group:
   - **Online Payment** (selected by default when Stripe is enabled). Explains that the participant is redirected to Stripe's secure checkout to finish paying, returns here afterwards, and that card details are never stored by CFCA. Shows supported method badges: Visa, Mastercard, American Express, Apple Pay, Link, Klarna, Zip. CTA: **Pay $X online**.
   - **Bank Payment**: BSB/account details, Unique Code instructions, How to Pay mockup, and **I've noted the bank details — continue**.
   - When Stripe is not enabled, only Bank Payment is shown (selected).
2. **Your Registration** summary (name, Unique Code, registration no, amounts, remaining balance, status) at the bottom.

### Payment outcomes

| Outcome | Trigger | Participant sees |
|---------|---------|------------------|
| Success | `checkout.session.completed` (paid) or `async_payment_succeeded`; return page confirms via status | Success alert; registration marked paid; receipt email |
| Processing | Checkout complete but funds not settled (delayed methods) | Spinner; page polls status every 3s |
| Failed | `async_payment_failed` or PaymentIntent failed | Error alert, "not charged", link to retry or pay by bank |
| Cancelled | User clicks back on Stripe → `cancel_url?payment=cancelled` | Warning on pay step, Online panel reopened |
| Expired | Session unused for 30 minutes (`expires_at`) → `checkout.session.expired` | Error alert with retry link (new session each attempt) |
| Timeout | Status still unknown after 45s of polling | Warning: do not pay again; payment will appear and a receipt will be emailed |
| Start timeout | Creating a session takes over 20s | Error on pay step suggesting retry or bank transfer |
| Start failed | Stripe rejects session creation (bad key, account not activated, etc.) | HTTP 502 with Stripe error code in the message, suggesting Bank Payment; server log + audit `payment.stripe_checkout_start_failed` (type, code, request id) |

All outcomes are written to `audit_log` (`payment.stripe_checkout_*`, `payment.stripe_failed`).

## Acceptance criteria

- [ ] Default workflow is V1 with identical classic redirects
- [ ] Admin can switch V1 ↔ V2 in Registration Settings without redeploy
- [ ] V2 pay step offers Bank always; Online when Stripe enabled
- [ ] Online redirects to Stripe-hosted Checkout (no embedded Payment Element)
- [ ] Stripe never receives card data on our servers
- [ ] Webhook events verified by re-fetching from Stripe API; payment ledger idempotent by PaymentIntent id
- [ ] Only `STRIPE_SECRET_KEY` is required for Stripe
- [ ] Success, processing, failure, cancellation, expiry, and timeout each show a clear message and never mark unpaid registrations as paid
- [ ] Audit covers workflow changes and Stripe payment events

## Out of scope

- Automatic Stripe refunds on overpayment
- Controlling which payment methods Stripe offers in code — enable or disable methods (e.g. Klarna, Zip) in the Stripe Dashboard
- Embedded Checkout / Payment Element

## Related specs

- `features.registration`
- `features.payment`
- `features.registration-complete`
- `features.dashboard`
