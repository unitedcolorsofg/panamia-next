-- Migration: add_attachment_peaks
-- Purpose: Add peaks field to SocialAttachment for audio waveform visualization
-- Ticket: N/A
-- Reversible: Yes

ALTER TABLE "social_attachments" ADD COLUMN "peaks" JSONB;
