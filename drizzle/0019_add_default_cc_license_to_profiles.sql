-- Migration: 0019_add_default_cc_license_to_profiles
-- Purpose: Give each profile a default Creative Commons license that pre-selects
--          the license picker when the user composes new Articles (/a) and social
--          timeline posts (/s). New users default to CC BY 4.0; the choice is
--          editable in Advanced Settings and overridable per item at compose time.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: 0010_add_cc_license, 0018_add_cc0_to_cc_license
-- Data Migration: Inline — existing rows are backfilled with the 'cc-by-4' default.
--
-- Rollback:
--   ALTER TABLE "profiles" DROP COLUMN "default_cc_license";
--
-- =============================================================================

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "default_cc_license" "cc_license" DEFAULT 'cc-by-4' NOT NULL;
