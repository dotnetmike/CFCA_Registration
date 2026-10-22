-- Payment reconciliation: Stripe balance history + CBA bank statement CSV imports,
-- run history, per-row status (with admin overrides) and an activity log.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reconciliation_status') THEN
    CREATE TYPE public.reconciliation_status AS ENUM ('matched', 'unmatched', 'ignored', 'not_applicable');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('stripe', 'bank', 'recheck')),
  filename text,
  file_sha256 text,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  rows_in_file integer NOT NULL DEFAULT 0,
  new_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  rechecked_rows integer NOT NULL DEFAULT 0,
  matched integer NOT NULL DEFAULT 0,
  unmatched integer NOT NULL DEFAULT 0,
  not_applicable integer NOT NULL DEFAULT 0,
  payments_applied integer NOT NULL DEFAULT 0,
  amount_applied numeric(12,2) NOT NULL DEFAULT 0,
  error text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.stripe_balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_txn_id text NOT NULL UNIQUE,
  type text NOT NULL,
  source_id text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL,
  fee numeric(12,2) NOT NULL DEFAULT 0,
  net numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'aud',
  created_utc timestamptz NOT NULL,
  available_on_utc timestamptz NOT NULL,
  metadata_registration_id text NOT NULL DEFAULT '',
  metadata_participant_reference text NOT NULL DEFAULT '',
  status public.reconciliation_status NOT NULL DEFAULT 'unmatched',
  status_reason text NOT NULL DEFAULT '',
  match_method text NOT NULL DEFAULT '',
  matched_registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  manual_override boolean NOT NULL DEFAULT false,
  status_comment text NOT NULL DEFAULT '',
  status_updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status_updated_at timestamptz,
  first_run_id uuid REFERENCES public.reconciliation_runs(id) ON DELETE SET NULL,
  last_run_id uuid REFERENCES public.reconciliation_runs(id) ON DELETE SET NULL,
  raw jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  transaction_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  description text NOT NULL DEFAULT '',
  balance numeric(12,2),
  kind text NOT NULL CHECK (kind IN ('transfer', 'stripe_payout', 'debit')),
  status public.reconciliation_status NOT NULL DEFAULT 'unmatched',
  status_reason text NOT NULL DEFAULT '',
  match_method text NOT NULL DEFAULT '',
  matched_registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  matched_stripe_payout_id text NOT NULL DEFAULT '',
  manual_override boolean NOT NULL DEFAULT false,
  status_comment text NOT NULL DEFAULT '',
  status_updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status_updated_at timestamptz,
  first_run_id uuid REFERENCES public.reconciliation_runs(id) ON DELETE SET NULL,
  last_run_id uuid REFERENCES public.reconciliation_runs(id) ON DELETE SET NULL,
  raw jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Payments applied (or reversed, negative amount) from a reconciled bank line.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS reconciliation_bank_line_id uuid
    REFERENCES public.bank_statement_lines(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.reconciliation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.reconciliation_runs(id) ON DELETE SET NULL,
  item_type text CHECK (item_type IN ('stripe', 'bank')),
  item_id uuid,
  action text NOT NULL,
  from_status text,
  to_status text,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  amount numeric(12,2),
  comment text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}',
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_created_at ON public.reconciliation_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_balance_transactions_status ON public.stripe_balance_transactions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_balance_transactions_created ON public.stripe_balance_transactions(created_utc DESC);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_status ON public.bank_statement_lines(status);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_date ON public.bank_statement_lines(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_reconciliation_bank_line_id
  ON public.payments(reconciliation_bank_line_id) WHERE reconciliation_bank_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reconciliation_events_item ON public.reconciliation_events(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_events_created_at ON public.reconciliation_events(created_at DESC);

ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_balance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_balance_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.reconciliation_runs, public.stripe_balance_transactions,
  public.bank_statement_lines, public.reconciliation_events FROM anon, authenticated;
