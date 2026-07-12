-- Migration runner infrastructure
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.run_migration(migration_name text, migration_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.schema_migrations WHERE name = migration_name) THEN
    RETURN;
  END IF;

  EXECUTE migration_sql;
  INSERT INTO public.schema_migrations (name) VALUES (migration_name);
END;
$$;
-- Auth tables: users, groups, permissions, refresh tokens

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.user_group_permissions (
  group_id uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_user_groups (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON public.refresh_tokens(token_hash);

-- Seed groups
INSERT INTO public.user_groups (name, description) VALUES
  ('admin', 'Full system access'),
  ('registration_manager', 'Manage registration info'),
  ('accommodation_manager', 'Manage transport and accommodation'),
  ('participant', 'Conference participant')
ON CONFLICT (name) DO NOTHING;

-- Seed permissions
INSERT INTO public.permissions (key, description) VALUES
  ('registrations:read_all', 'Read all registrations'),
  ('registrations:write_all', 'Write all registration fields'),
  ('registrations:read_own', 'Read own registration'),
  ('registrations:write_own', 'Write own registration'),
  ('accommodation:write_all', 'Write accommodation and transport fields'),
  ('payments:reconcile', 'Upload bank statements and reconcile'),
  ('payments:read_all', 'Read all payment info'),
  ('reports:read', 'View reports'),
  ('users:manage', 'Manage users and sessions')
ON CONFLICT (key) DO NOTHING;

-- Admin gets all permissions
INSERT INTO public.user_group_permissions (group_id, permission_id)
SELECT g.id, p.id
FROM public.user_groups g
CROSS JOIN public.permissions p
WHERE g.name = 'admin'
ON CONFLICT DO NOTHING;

-- Registration manager permissions
INSERT INTO public.user_group_permissions (group_id, permission_id)
SELECT g.id, p.id
FROM public.user_groups g
JOIN public.permissions p ON p.key IN (
  'registrations:read_all', 'registrations:write_all', 'payments:read_all', 'reports:read'
)
WHERE g.name = 'registration_manager'
ON CONFLICT DO NOTHING;

-- Accommodation manager permissions
INSERT INTO public.user_group_permissions (group_id, permission_id)
SELECT g.id, p.id
FROM public.user_groups g
JOIN public.permissions p ON p.key IN (
  'registrations:read_all', 'accommodation:write_all', 'reports:read'
)
WHERE g.name = 'accommodation_manager'
ON CONFLICT DO NOTHING;

-- Participant permissions
INSERT INTO public.user_group_permissions (group_id, permission_id)
SELECT g.id, p.id
FROM public.user_groups g
JOIN public.permissions p ON p.key IN (
  'registrations:read_own', 'registrations:write_own', 'payments:read_all'
)
WHERE g.name = 'participant'
ON CONFLICT DO NOTHING;
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
  pickup_transport_contact_name text NOT NULL DEFAULT '',
  pickup_transport_contact_phone text NOT NULL DEFAULT '',
  dropoff_transport_contact_name text NOT NULL DEFAULT '',
  dropoff_transport_contact_phone text NOT NULL DEFAULT '',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  amount_due numeric(10,2) NOT NULL DEFAULT 0,
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  payment_last_updated_source public.payment_source,
  payment_last_updated_at timestamptz,
  payment_last_updated_by uuid REFERENCES public.users(id),
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

CREATE TABLE IF NOT EXISTS public.registration_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_admin_notes_registration_id
  ON public.registration_admin_notes(registration_id, created_at DESC);

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
-- Payments, bank statements, email log

CREATE TYPE public.payment_source AS ENUM ('manual', 'bank_reconcile');

CREATE TYPE public.bank_statement_status AS ENUM ('processing', 'completed', 'failed');

CREATE TYPE public.match_status AS ENUM ('auto_matched', 'unmatched', 'confirmed', 'skipped');

CREATE TABLE IF NOT EXISTS public.bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.users(id),
  status public.bank_statement_status NOT NULL DEFAULT 'processing',
  parsed_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_statement_id uuid NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  transaction_date date,
  description text NOT NULL DEFAULT '',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  extracted_reference text NOT NULL DEFAULT '',
  matched_registration_id uuid REFERENCES public.registrations(id),
  match_confidence numeric(3,2) NOT NULL DEFAULT 0,
  match_status public.match_status NOT NULL DEFAULT 'unmatched',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  reference_text text NOT NULL DEFAULT '',
  source public.payment_source NOT NULL DEFAULT 'manual',
  bank_statement_id uuid REFERENCES public.bank_statements(id),
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.email_type AS ENUM (
  'registration_submitted', 'registration_updated',
  'accommodation_updated', 'payment_received', 'payment_reminder'
);

CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  email_type public.email_type NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL DEFAULT '',
  resend_id text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_registration_id ON public.payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_statement_id ON public.bank_transactions(bank_statement_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_reference ON public.bank_transactions(extracted_reference);
CREATE INDEX IF NOT EXISTS idx_email_log_registration_id ON public.email_log(registration_id);
-- Storage bucket for bank statements (create via SQL if supported, otherwise manual in dashboard)
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-statements', 'bank-statements', false)
ON CONFLICT (id) DO NOTHING;
-- Disable RLS on app tables (custom auth handles authorization server-side)
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_group_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_user_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.refresh_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registration_attendees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.early_bird_counters DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_statements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schema_migrations DISABLE ROW LEVEL SECURITY;

-- Grant access to Supabase API roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
