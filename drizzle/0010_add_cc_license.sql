-- Migration: 0010_add_cc_license
-- Purpose: Phase 4 content licensing — add cc_license enum and column to
--          articles, social_statuses, and event_photos tables. All user-generated
--          content must be Creative Commons licensed (CC BY 4.0 or CC BY-SA 4.0).
--          Default is CC BY-SA 4.0.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: 0000_initial_schema (articles, social_statuses, event_photos)

-- Create the cc_license enum
DO $$ BEGIN
  CREATE TYPE "public"."cc_license" AS ENUM('cc-by-4', 'cc-by-sa-4');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Add cc_license to articles
ALTER TABLE "articles" ADD COLUMN "cc_license" "public"."cc_license" NOT NULL DEFAULT 'cc-by-sa-4';
--> statement-breakpoint

-- Add cc_license to social_statuses
ALTER TABLE "social_statuses" ADD COLUMN "cc_license" "public"."cc_license" NOT NULL DEFAULT 'cc-by-sa-4';
--> statement-breakpoint

-- Add cc_license to event_photos
ALTER TABLE "event_photos" ADD COLUMN "cc_license" "public"."cc_license" NOT NULL DEFAULT 'cc-by-sa-4';
