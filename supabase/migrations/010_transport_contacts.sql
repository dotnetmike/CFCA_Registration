-- Admin-assigned airport transport contacts (pickup / dropoff may differ)

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS pickup_transport_contact_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_transport_contact_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dropoff_transport_contact_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dropoff_transport_contact_phone text NOT NULL DEFAULT '';
