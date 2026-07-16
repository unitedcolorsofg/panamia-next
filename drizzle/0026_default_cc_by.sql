-- Migration: 0026_default_cc_by
-- Purpose: Change the default content license from CC BY-SA 4.0 to CC BY 4.0 on
--          articles.cc_license and social_statuses.cc_license. This aligns the
--          column DEFAULT with the per-user default already returned by
--          useDefaultCcLicense (cc-by-4) and the API write fallbacks, which had
--          drifted apart. Only the DEFAULT changes; existing rows keep whatever
--          license they were stored with.
-- Ticket: N/A
-- Reversible: Yes -- set the defaults back to 'cc-by-sa-4'.
--
-- Dependencies: 0010_add_cc_license (columns exist), 0018_add_cc0_to_cc_license
--               (enum value present, though unused by this change).
-- Data Migration: None. No stored value is rewritten.
-- =============================================================================

--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "cc_license" SET DEFAULT 'cc-by-4';
--> statement-breakpoint
ALTER TABLE "social_statuses" ALTER COLUMN "cc_license" SET DEFAULT 'cc-by-4';
