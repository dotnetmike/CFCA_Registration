-- CFCA bank account details for bank transfer payments (managed in Dashboard Settings)
ALTER TABLE public.runtime_registration_settings
  ADD COLUMN IF NOT EXISTS bank_account_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_bsb text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account_number text NOT NULL DEFAULT '';
