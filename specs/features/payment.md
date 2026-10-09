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
  - src/lib/payments/labels.ts
  - src/components/payments/payment-summary.tsx
  - src/components/payments/payment-status-badge.tsx
  - src/lib/dashboard/reports-csv.ts
---

# Payment information

## Purpose

Show how to pay the balance due using the **Unique Code** (bank) and, when workflow V2 + Stripe are enabled, online card/wallets.

## Payment wording (canonical — applies to every participant screen, email, and the admin dashboard)

Source of truth: `src/lib/payments/labels.ts`. One name per idea; never mix synonyms.

| Value | Label | Notes |
|-------|-------|-------|
| `amount_due` (original charge incl. souvenirs) | **Registration fee** | Never “Amount Due” / “Total due” |
| `amount_paid` | **Amount paid** | |
| `max(0, amount_due − amount_paid)` | **Balance due** | Never “Remaining balance” / “Remaining” / “outstanding” |
| `payment_status` | **Payment status** badge | `pending` → **Unpaid**, `partial` → **Part paid**, `paid` → **Paid**, `overpaid` → **Overpaid** (never raw lowercase values) |

Presentation (`PaymentSummary` component and email payment rows):

- Order: **Payment status** badge, **Registration fee**, **Amount paid**, then **Balance due** only when it is greater than $0.00.
- When balance due is $0.00: no banner and no “no remaining balance” message; the Paid badge says it.
- When money is owed: a callout naming the amount (“**Balance due: $X**”) with a **Pay $X** action where online/bank payment is available. Emails include the bank-reference reminder only when a balance is due.
- **Unique Code** label and red styling are unchanged (it is the bank payment reference).
- Admin CSV export keeps raw DB column names and adds a computed `balance_due` column.

## Behavior

- Protected. Requires participant reference (or non-DRAFT registration no).
- Public UI labels use **Unique Code** for Message and Ref.
- Show the payment summary using the canonical wording above.
- **Workflow V1:** Bank Transfer Details + How to Pay mockup (unchanged).
- **Workflow V2:** radio choice of Online Payment (default, Stripe hosted Checkout when keys set) or Bank Payment, followed by the registration summary. Pays the balance due only; when balance due is $0.00 the options are hidden and only the summary (Paid badge) shows.
- Guest V2 first-time pay also uses `/register/pay` (see `features.registration-workflow-v2`).
- **CFCA bank account** (account name, BSB, account number) is a runtime setting edited in Dashboard → Registration Settings → **Bank Transfer Details** (no env vars). Served to payment pages via `GET /api/registration-settings` (`settings.bankDetails`) and `GET /api/payments/pay-context` (`bankDetails`). BSB stored as `123-456`; account number 4–10 digits. If any field is blank, payment pages show “Bank transfer details are not available yet. Please contact the registration team.” instead of the details. Changes audited as `settings.bank_details_changed`.
- Stripe: `STRIPE_SECRET_KEY` only, plus a Dashboard webhook URL to `/api/payments/stripe/webhook`.
- Online Payment redirects to Stripe Checkout; webhook + optional `session_id` status recovery mark the registration paid.
- Administrators configure payment reminder dates in Registration Settings. The authorized daily cron sends reminders only to submitted registrations with `pending` or `partial` payment status.
- After the configurable early-bird payment due date, that cron updates pending/partial early-bird registrations to regular pricing and clears their early-bird status. Fully paid registrations retain their original price.

## Acceptance criteria

- [ ] Unique Code emphasized for Message and Ref.
- [ ] Registration fee / Amount paid / Balance due / Payment status badge wording is used consistently on all screens, emails, and admin
- [ ] A fully paid registration shows a Paid badge, no zero-balance banner, and no $0.00 Balance due row
- [ ] How to Pay is the last section
- [ ] Reminder dates and early-bird payment due date are configurable without deployment
- [ ] Bank account name, BSB, and account number are configurable in Dashboard Settings without deployment
- [ ] Incomplete bank details show a contact-the-team notice instead of placeholder values

## Related specs

- `features.registration`
- `features.my-registration`
- `features.dashboard`
