-- Migration: 0007_drop_accounts_password
-- Purpose: Remove the password column from accounts. Panamia uses magic-link
--          and OAuth authentication exclusively; credential-based login is not
--          supported. Dropping this column eliminates a FIPA breach-notification
--          vector (email + password hash) and aligns the schema with actual auth
--          posture.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: 0001_better_auth_schema
-- Data Migration: None (column is null for all rows — no credential accounts exist)
--
-- Rollback:
--   ALTER TABLE "accounts" ADD COLUMN "password" text;
--
-- =============================================================================

ALTER TABLE "accounts" DROP COLUMN IF EXISTS "password";--> statement-breakpoint
