---
id: features.payment
title: Payment information
status: active
synced_commit: working-tree
synced_at: 2026-07-11
owners: [team]
files:
  - src/app/payment/page.tsx
  - src/components/registrations/payment-reference-mockup.tsx
---

# Payment information

## Purpose

Show bank details and how to pay using the unique payment reference.

## Behavior

- Protected. Requires participant reference (or non-DRAFT registration no).
- Sections order: Your Registration â†?Bank Transfer Details â†?reminder note â†?**How to Pay** (mockup last).
- Mockup uses unique code + outstanding/amount due.
- Public env bank fields: `NEXT_PUBLIC_BANK_*`.

## Acceptance criteria

- [ ] Unique code emphasized for Message and Ref.
- [ ] How to Pay is the last section

## Related specs

- `features.registration`
- `features.my-registration`
