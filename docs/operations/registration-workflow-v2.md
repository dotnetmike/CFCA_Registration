# Flip registration workflow to V2 (online payment)

Use this after Stripe is configured and V2 has been smoke-tested.

## Prerequisites

1. Migration `019_registration_workflow_v2_stripe.sql` applied.
2. Env set: `STRIPE_SECRET_KEY` only (Stripe Dashboard → Developers → API keys → Secret key).
3. Stripe Dashboard → Developers → Webhooks → Add endpoint: `https://YOUR_DOMAIN/api/payments/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`
   - No signing secret is needed: the handler re-fetches each event from Stripe with the secret key before acting.
4. Local: `stripe listen --forward-to localhost:3000/api/payments/stripe/webhook`.
5. Local/preview check while Dashboard still on V1: open `/?workflow=v2` or `/register?workflow=v2`.

## Enable V2 for everyone

1. Dashboard → Registration Settings.
2. Set **Registration payment workflow** to **V2 — Online payment capability**.
3. Save. Confirm audit action `settings.registration_workflow_changed`.
4. Guest submit should show **Submit and Pay** and land on `/register/pay`.

## Rollback

Set workflow back to **V1 — Classic** in the same Settings page. No migration undo required. Existing Stripe payment rows remain on the registration.

## Emergency override

`REGISTRATION_WORKFLOW=v1|v2` in env overrides the Dashboard setting (local/emergency only). Prefer Dashboard for production control.
