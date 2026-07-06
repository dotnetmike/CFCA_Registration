-- Registration schema

CREATE TYPE public.cfca_position AS ENUM (
  'member', 'hh_leader', 'unit_leader', 'chapter_leader',
  'ministry_coordinator', 'area_coordinator', 'area_head', 'national_council'
);

CREATE TYPE public.australian_state AS ENUM (
  'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'
);

CREATE TYPE public.accommodation_type AS ENUM ('own', 'billet');

CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid', 'overpaid');

CREATE TYPE public.early_bird_slot AS ENUM ('interstate', 'melbourne', 'none');

CREATE SEQUENCE IF NOT EXISTS registration_no_seq START 1;

CREATE TABLE IF NOT EXISTS public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_no text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  surname text NOT NULL DEFAULT '',
  given_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  address_line1 text NOT NULL DEFAULT '',
  address_line2 text NOT NULL DEFAULT '',
  suburb text NOT NULL DEFAULT '',
  address_state public.australian_state,
  postcode text NOT NULL DEFAULT '',
  cfca_position public.cfca_position,
  state public.australian_state,
  spouse_surname text NOT NULL DEFAULT '',
  spouse_given_name text NOT NULL DEFAULT '',
  spouse_attending boolean NOT NULL DEFAULT false,
  spouse_email text NOT NULL DEFAULT '',
  spouse_mobile text NOT NULL DEFAULT '',
  accommodation_type public.accommodation_type,
  pickup_melbourne_airport boolean,
  dropoff_melbourne_airport boolean,
  hotel_transport_required boolean,
  arrival_date date,
  arrival_airport text NOT NULL DEFAULT '',
  arrival_flight_no text NOT NULL DEFAULT '',
  departure_date date,
  departure_airport text NOT NULL DEFAULT '',
  departure_flight_no text NOT NULL DEFAULT '',
  hotel_name text NOT NULL DEFAULT '',
  hotel_address text NOT NULL DEFAULT '',
  accommodation_contact_name text NOT NULL DEFAULT '',
  accommodation_contact_phone text NOT NULL DEFAULT '',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  amount_due numeric(10,2) NOT NULL DEFAULT 0,
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  is_early_bird boolean NOT NULL DEFAULT false,
  early_bird_slot public.early_bird_slot NOT NULL DEFAULT 'none',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.registration_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  surname text NOT NULL DEFAULT '',
  given_name text NOT NULL DEFAULT '',
  age integer NOT NULL DEFAULT 0,
  needs_kids_supervision boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.early_bird_counters (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  interstate_remaining integer NOT NULL DEFAULT 250,
  melbourne_remaining integer NOT NULL DEFAULT 200,
  window_start date NOT NULL DEFAULT '2025-10-01',
  window_end date NOT NULL DEFAULT '2026-02-28'
);

INSERT INTO public.early_bird_counters (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON public.registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_state ON public.registrations(state);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON public.registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_registration_attendees_reg_id ON public.registration_attendees(registration_id);

CREATE OR REPLACE FUNCTION public.generate_registration_no(prefix text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  seq_val bigint;
BEGIN
  seq_val := nextval('registration_no_seq');
  RETURN prefix || '-' || lpad(seq_val::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_early_bird_slot(p_state public.australian_state)
RETURNS public.early_bird_slot
LANGUAGE plpgsql
AS $$
DECLARE
  counters public.early_bird_counters%ROWTYPE;
  slot public.early_bird_slot := 'none';
BEGIN
  SELECT * INTO counters FROM public.early_bird_counters WHERE id = 1 FOR UPDATE;

  IF current_date < counters.window_start OR current_date > counters.window_end THEN
    RETURN 'none';
  END IF;

  IF p_state = 'VIC' AND counters.melbourne_remaining > 0 THEN
    UPDATE public.early_bird_counters SET melbourne_remaining = melbourne_remaining - 1 WHERE id = 1;
    RETURN 'melbourne';
  ELSIF p_state != 'VIC' AND counters.interstate_remaining > 0 THEN
    UPDATE public.early_bird_counters SET interstate_remaining = interstate_remaining - 1 WHERE id = 1;
    RETURN 'interstate';
  END IF;

  RETURN 'none';
END;
$$;
