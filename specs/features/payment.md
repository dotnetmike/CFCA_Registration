---
id: features.payment
title: Payment information
status: active
synced_commit: working-tree
synced_at: 2026-07-13
owners: [team]
files:
  - src/app/payment/page.tsx
  - src/components/registrations/payment-reference-mockup.tsx
  - src/app/my-registration/page.tsx
  - src/app/r/[token]/page.tsx
  - src/lib/email/send.ts
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

## Acceptance criteria

- [ ] Unique Code emphasized for Message and Ref.
- [ ] Remaining balance is shown where payment amounts are shown
- [ ] How to Pay is the last section

## Related specs

- `features.registration`
- `features.my-registration`
- `features.dashboard`
