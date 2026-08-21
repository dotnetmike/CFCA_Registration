ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS dietary_requirements text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS spouse_dietary_requirements text NOT NULL DEFAULT '';

ALTER TABLE public.registration_attendees
  ADD COLUMN IF NOT EXISTS dietary_requirements text NOT NULL DEFAULT '';
