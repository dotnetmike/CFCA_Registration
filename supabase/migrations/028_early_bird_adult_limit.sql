-- Number of adults on a registration priced at the early-bird rate
-- (registrant, then spouse, then additional adults 18+ in attendee order).
-- NULL = all adults (every registration created before per-adult early bird), so existing fees are unchanged.
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS early_bird_adult_limit integer
  CHECK (early_bird_adult_limit IS NULL OR early_bird_adult_limit >= 0);
