-- Migration: add_status_location
-- Purpose: Add geolocation support to social statuses (ActivityPub Place object)
-- Ticket: N/A
-- Reversible: Yes
--
-- Rollback:
--   ALTER TABLE "social_statuses" DROP COLUMN "location";

ALTER TABLE "social_statuses" ADD COLUMN "location" JSONB;
