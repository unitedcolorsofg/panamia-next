-- Migration: 0002_emailverified_boolean
-- Purpose: Change users.email_verified from timestamptz to boolean to match
--          better-auth's internal schema (passes true/false, not Date objects).
--          Eliminates the toISOString() TypeError on magic link verification.
-- Ticket: N/A
-- Reversible: Partial (data is coerced; original timestamps are lost)
--
-- Dependencies: 0001_better_auth_schema
-- Data Migration: Inline — existing non-NULL timestamps → true, NULL → false
--
-- Rollback:
--   ALTER TABLE "users" ALTER COLUMN "email_verified" DROP DEFAULT;
--   ALTER TABLE "users" ALTER COLUMN "email_verified" DROP NOT NULL;
--   ALTER TABLE "users" ALTER COLUMN "email_verified" TYPE timestamp with time zone
--     USING (CASE WHEN "email_verified" THEN now() ELSE NULL END);
--
-- =============================================================================

ALTER TABLE "users" ALTER COLUMN "email_verified" TYPE boolean USING ("email_verified" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET DEFAULT false;
