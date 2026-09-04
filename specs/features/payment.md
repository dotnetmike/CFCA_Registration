---
id: features.payment
title: Payment information
status: active
synced_commit: 743bec3
synced_at: 2026-08-20
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

Show bank details and how to pay using the **Unique Code**.

## Behavior

- Protected. Requires participant reference (or non-DRAFT registration no).
- Public UI labels use **Unique Code** (not ?Payment Reference?) for the code to put in Message and Ref.
- Show amount due, amount paid, and **Remaining balance** (`amount_due - amount_paid`).
- Sections order: Your Registration ? Bank Transfer Details ? reminder ? **How to Pay** (mockup last).
- Mockup uses unique code + outstanding/amount due.
- Public env bank fields: `NEXT_PUBLIC_BANK_*`.
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
