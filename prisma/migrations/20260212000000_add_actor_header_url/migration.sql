-- Migration: add_actor_header_url
-- Purpose: Add banner/header image URL to SocialActor for federation profile display
-- Ticket: N/A
-- Reversible: Yes
--
-- Rollback:
--   ALTER TABLE "SocialActor" DROP COLUMN "headerUrl";

-- AlterTable
ALTER TABLE "SocialActor" ADD COLUMN "headerUrl" TEXT;
