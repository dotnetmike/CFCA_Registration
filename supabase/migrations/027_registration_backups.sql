-- Daily automatic registration backups: one zipped CSV per Melbourne day,
-- stored in a private storage bucket and listed for admins.

INSERT INTO public.permissions (key, description) VALUES
  ('backups:manage', 'View and download registration backups')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.user_group_permissions (group_id, permission_id)
SELECT g.id, p.id
FROM public.user_groups g
JOIN public.permissions p ON p.key = 'backups:manage'
WHERE g.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('registration-backups', 'registration-backups', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.registration_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_date date NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed')),
  file_path text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  size_bytes bigint NOT NULL DEFAULT 0,
  registration_count integer NOT NULL DEFAULT 0,
  file_sha256 text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_registration_backups_backup_date
  ON public.registration_backups(backup_date DESC);

ALTER TABLE public.registration_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_backups FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_backups FROM anon, authenticated;
