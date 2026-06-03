-- Migration: 0021_drop_users_role
-- Purpose: Drop the unused users.role column. Admin access is derived entirely
--          from the ADMIN_EMAILS env var (surfaced as session.user.isAdmin by
--          enrichUserFields in auth.ts); the column was never set to anything
--          other than its 'user' default and no code gates on it anymore, so it
--          was dead data. Distinct from event_organizers.role, which is unrelated
--          and kept.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: 0000_initial_schema (users table)
-- Data Migration: None — column held only the constant default 'user'; no data
--                  is preserved.
--
-- Rollback:
--   ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;
--
-- =============================================================================

ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
