-- Migration: 0006_ghl_profiles
-- Purpose: Add GHL (GoHighLevel CRM) fields to the profiles table.
--          ghl_contact_id links a Panamia profile to a GHL contact record.
--          ghl_opted_out prevents the CRM worker from recreating contacts
--          that the user has explicitly deleted via the privacy portal.
-- Ticket: N/A
-- Reversible: Yes
--
-- Rollback:
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "ghl_contact_id";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "ghl_opted_out";
--
-- Dependencies: 0000_initial_schema (profiles table must exist)
-- =============================================================================

--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "ghl_contact_id" text;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "ghl_opted_out" boolean DEFAULT false NOT NULL;
