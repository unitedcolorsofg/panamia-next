-- Migration: add_actor_header_url
-- Purpose: Add banner/header image URL to social_actors for federation profile display
-- Ticket: N/A
-- Reversible: Yes
--
-- Rollback:
--   ALTER TABLE "social_actors" DROP COLUMN "headerUrl";

-- AlterTable
ALTER TABLE "social_actors" ADD COLUMN "headerUrl" TEXT;
