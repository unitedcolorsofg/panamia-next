-- Migration: 0014_lockdown_public_schema_api
-- Purpose: Resolve Supabase security advisors (rls_disabled_in_public,
--          sensitive_columns_exposed) by blocking the PostgREST anon /
--          authenticated roles from reaching the public schema. The app
--          connects via Drizzle/postgres.js using a privileged role
--          (POSTGRES_URL / POSTGRES_DIRECT_URL) which bypasses RLS, so
--          locking down the API roles has no impact on app traffic.
-- Ticket: N/A (infrastructure / security hardening)
-- Reversible: Yes (see Rollback below)
--
-- Dependencies: None
-- Data Migration: None
--
-- Rollback:
--   GRANT USAGE ON SCHEMA public TO anon, authenticated;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
--   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
--   -- Then per-table: ALTER TABLE public.<t> DISABLE ROW LEVEL SECURITY;
--
-- =============================================================================

-- 1) Enable RLS on every existing table in public. With no policies attached,
--    this denies all access to non-bypass roles (anon, authenticated). The
--    privileged role used by the app's direct Postgres connection has
--    BYPASSRLS, so application queries are unaffected.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', r.schemaname, r.tablename);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY;', r.schemaname, r.tablename);
  END LOOP;
END
$$;

-- 2) Belt-and-braces: revoke all grants from the PostgREST API roles so even
--    if RLS were ever toggled off on a table, the anon/authenticated roles
--    still cannot reach it over the REST/GraphQL API.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

-- 3) Make the revocation sticky for any tables/sequences/functions created
--    later (e.g. by future Drizzle migrations) so we don't silently regress.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
