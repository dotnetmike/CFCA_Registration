---
id: features.payment
title: Payment information
status: active
synced_commit: working-tree
synced_at: 2026-10-08
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
  - supabase/migrations/021_bank_transfer_settings.sql
  - src/lib/payments/bank-details.ts
  - src/components/payments/bank-transfer-details.tsx
  - src/components/payments/payment-step.tsx
  - src/app/register/pay/page.tsx
  - src/app/api/payments/pay-context/route.ts
  - src/app/api/admin/registration-settings/route.ts
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
- **CFCA bank account** (account name, BSB, account number) is a runtime setting edited in Dashboard → Registration Settings → **Bank Transfer Details** (no env vars). Served to payment pages via `GET /api/registration-settings` (`settings.bankDetails`) and `GET /api/payments/pay-context` (`bankDetails`). BSB stored as `123-456`; account number 4–10 digits. If any field is blank, payment pages show “Bank transfer details are not available yet. Please contact the registration team.” instead of the details. Changes audited as `settings.bank_details_changed`.
- Stripe: `STRIPE_SECRET_KEY` only, plus a Dashboard webhook URL to `/api/payments/stripe/webhook`.
- Online Payment redirects to Stripe Checkout; webhook + optional `session_id` status recovery mark the registration paid.
- Administrators configure payment reminder dates in Registration Settings. The authorized daily cron sends reminders only to submitted registrations with `pending` or `partial` payment status.
- After the configurable early-bird payment due date, that cron updates pending/partial early-bird registrations to regular pricing and clears their early-bird status. Fully paid registrations retain their original price.

## Acceptance criteria

- [ ] Unique Code emphasized for Message and Ref.
- [ ] Remaining balance is shown where payment amounts are shown
- [ ] How to Pay is the last section
- [ ] Reminder dates and early-bird payment due date are configurable without deployment
- [ ] Bank account name, BSB, and account number are configurable in Dashboard Settings without deployment
- [ ] Incomplete bank details show a contact-the-team notice instead of placeholder values

## Related specs

- `features.registration`
- `features.my-registration`
- `features.dashboard`
