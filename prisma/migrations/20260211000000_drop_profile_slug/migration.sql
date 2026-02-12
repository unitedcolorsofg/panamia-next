-- Migration: drop_profile_slug
-- Purpose: Remove deprecated slug column from profiles table. Profile URLs
--          now use the user's screenname via /p/:screenname, making the
--          separate slug column unnecessary.
-- Ticket: N/A
-- Reversible: No (column data is not preserved)
--
-- Dependencies: 20260115140000_add_profiles
-- Data Migration: None
--
-- Rollback:
--   ALTER TABLE "profiles" ADD COLUMN "slug" TEXT;
--   CREATE UNIQUE INDEX "profiles_slug_key" ON "profiles"("slug");
--   CREATE INDEX "profiles_slug_idx" ON "profiles"("slug");
--
-- =============================================================================

-- Drop indexes first, then column
DROP INDEX IF EXISTS "profiles_slug_key";
DROP INDEX IF EXISTS "profiles_slug_idx";
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "slug";
