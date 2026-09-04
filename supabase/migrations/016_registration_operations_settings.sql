-- Ministry details, elder assembly attendance, and operations-controlled registration settings.

ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'non_member';

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS ministry text NOT NULL DEFAULT 'cfca',
  ADD COLUMN IF NOT EXISTS elder_assembly_attending boolean NOT NULL DEFAULT false;

ALTER TABLE public.runtime_registration_settings
  ADD COLUMN IF NOT EXISTS early_bird_payment_due_date date NOT NULL DEFAULT '2027-02-28',
  ADD COLUMN IF NOT EXISTS payment_reminder_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notification_recipient_email text NOT NULL DEFAULT '';

ALTER TABLE public.runtime_registration_settings
  ADD CONSTRAINT runtime_registration_settings_payment_due_date
    CHECK (early_bird_payment_due_date >= early_bird_start);