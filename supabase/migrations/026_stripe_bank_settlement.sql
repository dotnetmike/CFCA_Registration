-- Bank settlement of Stripe rows: the payout that paid each row out and the CBA line that
-- received that payout. Kept in sync after every reconciliation run, whichever export came first.

ALTER TABLE public.stripe_balance_transactions
  ADD COLUMN IF NOT EXISTS payout_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_line_id uuid REFERENCES public.bank_statement_lines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_received_date date;

CREATE INDEX IF NOT EXISTS idx_stripe_balance_transactions_bank_line_id
  ON public.stripe_balance_transactions(bank_line_id) WHERE bank_line_id IS NOT NULL;

ALTER TABLE public.reconciliation_runs
  ADD COLUMN IF NOT EXISTS bank_confirmed integer NOT NULL DEFAULT 0;
