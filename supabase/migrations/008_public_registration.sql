-- Public guest registration: nullable user_id, magic view token

ALTER TABLE public.registrations
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_user_id_key;

DROP INDEX IF EXISTS registrations_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_user_id_unique
  ON public.registrations (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS view_token_hash text,
  ADD COLUMN IF NOT EXISTS view_token_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS signup_token_hash text,
  ADD COLUMN IF NOT EXISTS signup_token_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_view_token_hash
  ON public.registrations (view_token_hash)
  WHERE view_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_signup_token_hash
  ON public.registrations (signup_token_hash)
  WHERE signup_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_email
  ON public.registrations (email);
