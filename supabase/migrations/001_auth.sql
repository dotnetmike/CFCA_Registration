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
