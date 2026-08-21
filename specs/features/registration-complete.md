---
id: features.registration-complete
title: Registration complete (optional signup)
status: active
synced_commit: 743bec3
synced_at: 2026-08-20
owners: [team]
files:
  - src/app/register/complete/page.tsx
  - src/app/api/auth/register-signup/route.ts
  - src/app/api/registrations/signup/[token]/route.ts
---

# Registration complete

## Purpose

After guest submit: celebrate registration, then optionally create an account.

## Behavior

- **Primary focus**: congratulations hero �?“Registration confirmed�? “Congratulations, {firstName}!�? welcome / looking forward to seeing them at the conference, confirmation email note (+ view link if `view` query present).
- **Secondary**: optional Create your account card (name, email read-only, password, confirm).
- Create account �?`POST /api/auth/register-signup` with `signupToken` �?session �?`/my-registration`.
- Skip for now �?keep congrats; remind they can signup later with same email.

## Acceptance criteria

- [ ] Congratulation message is the visual focus (not the account form)
- [ ] Account creation is optional
- [ ] Signup token expiry is enforced server-side

## Related specs

- `features.registration`
- `features.signup`
