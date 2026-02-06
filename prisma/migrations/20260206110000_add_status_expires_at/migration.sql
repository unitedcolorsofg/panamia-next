-- Migration: add_status_expires_at
-- Purpose: Add expiresAt column for DM/voice memo soft-delete expiration
-- Ticket: N/A
-- Reversible: Yes
--
-- Rollback:
--   ALTER TABLE "social_statuses" DROP COLUMN IF EXISTS "expiresAt";

ALTER TABLE "social_statuses" ADD COLUMN "expiresAt" TIMESTAMP(3);
