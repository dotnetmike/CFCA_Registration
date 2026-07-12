-- Payment last-update attribution + admin notes per registration

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS payment_last_updated_source public.payment_source,
  ADD COLUMN IF NOT EXISTS payment_last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_last_updated_by uuid REFERENCES public.users(id);

CREATE TABLE IF NOT EXISTS public.registration_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_admin_notes_registration_id
  ON public.registration_admin_notes(registration_id, created_at DESC);

ALTER TABLE public.registration_admin_notes DISABLE ROW LEVEL SECURITY;
