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
