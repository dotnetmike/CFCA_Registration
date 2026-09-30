---
id: features.payment
title: Payment information
status: active
synced_commit: 8ee5938
synced_at: 2026-09-06
owners: [team]
files:
  - src/app/payment/page.tsx
  - src/components/registrations/payment-reference-mockup.tsx
  - src/app/my-registration/page.tsx
  - src/app/r/[token]/page.tsx
  - src/lib/email/send.ts
  - src/app/api/cron/payment-reminders/route.ts
  - src/lib/registration-settings.ts
  - src/app/dashboard/settings/page.tsx
  - supabase/migrations/016_registration_operations_settings.sql
---

# Payment information

## Purpose

Show how to pay remaining balance using the **Unique Code** (bank) and, when workflow V2 + Stripe are enabled, online card/wallets.

## Behavior

- Protected. Requires participant reference (or non-DRAFT registration no).
- Public UI labels use **Unique Code** for Message and Ref.
- Show amount due, amount paid, and **Remaining balance** (`amount_due - amount_paid`).
- **Workflow V1:** Bank Transfer Details + How to Pay mockup (unchanged).
- **Workflow V2:** radio choice of Online Payment (default, Stripe hosted Checkout when keys set) or Bank Payment, followed by the registration summary. Pay remaining balance only.
- Guest V2 first-time pay also uses `/register/pay` (see `features.registration-workflow-v2`).
- Public env bank fields: `NEXT_PUBLIC_BANK_*`. Stripe: `STRIPE_SECRET_KEY` only, plus a Dashboard webhook URL to `/api/payments/stripe/webhook`.
- Online Payment redirects to Stripe Checkout; webhook + optional `session_id` status recovery mark the registration paid.
- Administrators configure payment reminder dates in Registration Settings. The authorized daily cron sends reminders only to submitted registrations with `pending` or `partial` payment status.
- After the configurable early-bird payment due date, that cron updates pending/partial early-bird registrations to regular pricing and clears their early-bird status. Fully paid registrations retain their original price.

## Acceptance criteria

- [ ] Unique Code emphasized for Message and Ref.
- [ ] Remaining balance is shown where payment amounts are shown
- [ ] How to Pay is the last section
- [ ] Reminder dates and early-bird payment due date are configurable without deployment

## Related specs

- `features.registration`
- `features.my-registration`
- `features.dashboard`
