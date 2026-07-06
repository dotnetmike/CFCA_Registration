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
