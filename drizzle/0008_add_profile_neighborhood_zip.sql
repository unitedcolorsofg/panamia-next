-- Migration: 0008_add_profile_neighborhood_zip
-- Purpose: Add neighborhood assignment (jsonb, multiple selections from a
--          predefined South Florida neighborhood list) and verified zip code
--          (sourced from GoHighLevel billing data, not user-provided) to
--          profiles. These support platform eligibility verification and
--          volunteer organization. Unrelated to the existing `locations` column
--          which tracks business service areas.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: 0000_initial_schema (profiles table)
-- Data Migration: None
--
-- Rollback:
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "neighborhoods";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "verified_zip_code";
--
-- =============================================================================

ALTER TABLE "profiles" ADD COLUMN "neighborhoods" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "verified_zip_code" text;--> statement-breakpoint
