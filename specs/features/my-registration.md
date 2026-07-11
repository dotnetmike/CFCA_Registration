---
id: features.my-registration
title: My Registration
status: active
synced_commit: working-tree
synced_at: 2026-07-11
owners: [team]
files:
  - src/app/my-registration/page.tsx
---

# My Registration

## Purpose

Logged-in summary of the userâ€™s registration.

## Behavior

- Protected. Loads own registration via `GET /api/registrations`.
- Empty â†?prompt to start `/register`.
- Shows payment reference (`participant_reference`), amounts, accommodation/transport, attendees.
- Edit â†?`/register`. Payment details â†?`/payment` when submitted.

## Acceptance criteria

- [ ] Only the ownerâ€™s registration is shown (non-managers)

## Related specs

- `features.registration`
- `features.payment`
