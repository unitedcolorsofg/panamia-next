-- Migration: 0015_lockdown_drizzle_migrations
-- Purpose: Enable RLS on drizzle.__drizzle_migrations so Supabase advisors
--          can't flag it under rls_disabled_in_public-style checks. The
--          drizzle schema is not granted to anon/authenticated (already
--          locked down), so PostgREST cannot reach this table either way;
--          this is belt-and-braces hardening.
-- Ticket: N/A (infrastructure / security hardening)
-- Reversible: Yes (see Rollback below)
--
-- Dependencies: 0014_lockdown_public_schema_api
-- Data Migration: None
--
-- Rollback:
--   ALTER TABLE drizzle.__drizzle_migrations DISABLE ROW LEVEL SECURITY;
--
-- =============================================================================

ALTER TABLE drizzle.__drizzle_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE drizzle.__drizzle_migrations FORCE ROW LEVEL SECURITY;
