-- Migration: 0011_account_deletion
-- Purpose: Add stripe_customer_id to profiles, create deletion_logs audit table, allow nullable FKs for content anonymization
-- Ticket: N/A
-- Reversible: Partial
--
-- Rollback:
--   DROP TABLE IF EXISTS deletion_logs;
--   ALTER TABLE "profiles" DROP COLUMN "stripe_customer_id";
--   ALTER TABLE "articles" ALTER COLUMN "author_id" SET NOT NULL;
--   ALTER TABLE "events" ALTER COLUMN "host_profile_id" SET NOT NULL;
--   ALTER TABLE "event_photos" ALTER COLUMN "uploader_profile_id" SET NOT NULL;
--

ALTER TABLE "profiles" ADD COLUMN "stripe_customer_id" text;

-- Allow nulls for anonymization of archived content
ALTER TABLE "articles" ALTER COLUMN "author_id" DROP NOT NULL;
ALTER TABLE "events" ALTER COLUMN "host_profile_id" DROP NOT NULL;
ALTER TABLE "event_photos" ALTER COLUMN "uploader_profile_id" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "deletion_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" text NOT NULL,
  "email" text NOT NULL,
  "screenname" text,
  "attribution_choice" text NOT NULL,
  "archived_content_ids" jsonb,
  "deleted_tables" jsonb,
  "third_party_results" jsonb,
  "ip" text,
  "completed_at" timestamp with time zone,
  "error" text
);
