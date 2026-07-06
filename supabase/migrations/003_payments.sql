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
