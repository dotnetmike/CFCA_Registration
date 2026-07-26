-- Harden Data API: enable RLS on all app tables and remove anon/authenticated grants.
-- Authorization remains in Next.js API routes; DB access uses service_role (bypasses RLS).

-- ---------------------------------------------------------------------------
-- Enable RLS (no policies for anon/authenticated → API roles cannot touch rows)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registration_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.early_bird_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registration_admin_notes ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners when using non-bypass roles (defense in depth)
ALTER TABLE IF EXISTS public.schema_migrations FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_group_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_user_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.refresh_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registrations FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registration_attendees FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.early_bird_counters FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_statements FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_log FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.password_reset_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registration_admin_notes FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Revoke Data API privileges from public roles
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Ensure service_role (and postgres) retain full access for server-side admin client
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;

-- Future objects in public: do not auto-grant to anon/authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO postgres, service_role;
