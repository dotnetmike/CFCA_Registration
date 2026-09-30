-- Registration workflow V2 + Stripe ledger (additive, backward compatible)

-- Workflow setting (default v1 = classic bank-after-submit)
ALTER TABLE public.runtime_registration_settings
  ADD COLUMN IF NOT EXISTS registration_workflow text NOT NULL DEFAULT 'v1';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'runtime_registration_settings_workflow_check'
  ) THEN
    ALTER TABLE public.runtime_registration_settings
      ADD CONSTRAINT runtime_registration_settings_workflow_check
      CHECK (registration_workflow IN ('v1', 'v2'));
  END IF;
END $$;

-- Extend payment_source enum with stripe (safe if already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_source' AND e.enumlabel = 'stripe'
  ) THEN
    ALTER TYPE public.payment_source ADD VALUE 'stripe';
  END IF;
END $$;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id
  ON public.payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
