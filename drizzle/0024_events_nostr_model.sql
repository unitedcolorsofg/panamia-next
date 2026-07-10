-- Migration: 0024_events_nostr_model
-- Purpose: Replace the panamia.club event model with the simpler, Nostr-mirrored
--          model from the panamia-resilience fork. Drops the event-management
--          surface (organizers, notes, photos), the Cloudflare live-streaming
--          columns, and the age/photo/dresscode/cancellation/tos complexity;
--          reduces event_visibility to (public, unlisted); adds event_mode +
--          rsvp_status; and rebuilds event_attendees for anonymous name+email
--          RSVPs plus inbound Nostr (kind 31925) RSVPs. Adds events.nostr_event_id
--          for the outbound NIP-52 kind-31923 mirror.
-- Ticket: N/A
-- Reversible: No (dropped tables/columns/enum values are not recoverable; the
--             followers/invite/private visibility values are intentionally gone
--             and slated for a post-merge phase per docs/EVENTS-ROADMAP.md).
--
-- Dependencies: 0023_nostr_schema (nostr enums/columns exist); greenfield DB —
--               no rows to migrate.
-- Data Migration: None (greenfield). Any pre-existing non-public visibility maps
--                 to 'unlisted' via the USING clause below.
--
-- Rollback: Not supported. Restore from the 0022/0023 schema snapshot if needed.
-- =============================================================================

--> statement-breakpoint

-- 1. Drop the event-management surface (their FKs to events go with the tables).
DROP TABLE IF EXISTS "event_photos";
--> statement-breakpoint
DROP TABLE IF EXISTS "event_notes";
--> statement-breakpoint
DROP TABLE IF EXISTS "event_organizers";
--> statement-breakpoint
DROP TABLE IF EXISTS "event_attendees";
--> statement-breakpoint

-- 2. New event enums.
CREATE TYPE "event_mode" AS ENUM ('online', 'offline', 'hybrid');
--> statement-breakpoint
CREATE TYPE "rsvp_status" AS ENUM ('going', 'maybe', 'not_going');
--> statement-breakpoint

-- 3. Reduce event_visibility to (public, unlisted). Recreate the type — Postgres
--    cannot DROP VALUE from an enum. Any non-public value maps to 'unlisted'.
ALTER TABLE "events" ALTER COLUMN "visibility" DROP DEFAULT;
--> statement-breakpoint
ALTER TYPE "event_visibility" RENAME TO "event_visibility_old";
--> statement-breakpoint
CREATE TYPE "event_visibility" AS ENUM ('public', 'unlisted');
--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "visibility" TYPE "event_visibility"
  USING (CASE WHEN "visibility"::text = 'public' THEN 'public' ELSE 'unlisted' END::"event_visibility");
--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "visibility" SET DEFAULT 'public';
--> statement-breakpoint
DROP TYPE "event_visibility_old";
--> statement-breakpoint

-- 4. events: drop the dropped-feature columns.
ALTER TABLE "events"
  DROP COLUMN IF EXISTS "age_restriction",
  DROP COLUMN IF EXISTS "photo_policy",
  DROP COLUMN IF EXISTS "dresscode",
  DROP COLUMN IF EXISTS "panamia_co_organizer",
  DROP COLUMN IF EXISTS "tos_accepted_at",
  DROP COLUMN IF EXISTS "cancelled_at",
  DROP COLUMN IF EXISTS "cancelled_by",
  DROP COLUMN IF EXISTS "cancellation_reason",
  DROP COLUMN IF EXISTS "stream_eligible",
  DROP COLUMN IF EXISTS "stream_status",
  DROP COLUMN IF EXISTS "cf_stream_id",
  DROP COLUMN IF EXISTS "cf_stream_playback_id",
  DROP COLUMN IF EXISTS "cf_stream_srt_url",
  DROP COLUMN IF EXISTS "cf_stream_srt_key",
  DROP COLUMN IF EXISTS "cf_stream_recording_url",
  DROP COLUMN IF EXISTS "stream_live_at",
  DROP COLUMN IF EXISTS "stream_ended_at";
--> statement-breakpoint

-- 5. events: add the new Nostr-model columns.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "cover_image_alt" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "mode" "event_mode" NOT NULL DEFAULT 'offline';
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT ARRAY[]::text[];
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "nostr_event_id" text;
--> statement-breakpoint

-- 6. events: host now required, venue now optional (online-only events).
ALTER TABLE "events" ALTER COLUMN "host_profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "venue_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_host_profile_id_profiles_id_fk"
  FOREIGN KEY ("host_profile_id") REFERENCES "profiles"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk"
  FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE restrict;
--> statement-breakpoint

-- 7. Rebuild event_attendees for anonymous (name+email) + Nostr RSVPs.
CREATE TABLE "event_attendees" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "event_id" text NOT NULL,
  "profile_id" text,
  "email" text,
  "name" text NOT NULL,
  "status" "rsvp_status" NOT NULL,
  "email_verified_at" timestamp with time zone,
  "responded_at" timestamp with time zone,
  "nostr_pubkey" text,
  "nostr_rsvp_at" timestamp with time zone,
  "nostr_event_id" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "event_attendees_event_email_unique" ON "event_attendees" ("event_id", "email");
--> statement-breakpoint
CREATE UNIQUE INDEX "event_attendees_event_profile_unique" ON "event_attendees" ("event_id", "profile_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "event_attendees_event_nostr_pubkey_unique" ON "event_attendees" ("event_id", "nostr_pubkey");
--> statement-breakpoint
CREATE INDEX "event_attendees_event_status_idx" ON "event_attendees" ("event_id", "status");
--> statement-breakpoint
CREATE INDEX "event_attendees_profile_id_idx" ON "event_attendees" ("profile_id");
--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_events_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_profile_id_profiles_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE cascade;
--> statement-breakpoint

-- 8. Drop the now-unused event enums.
DROP TYPE IF EXISTS "organizer_role";
--> statement-breakpoint
DROP TYPE IF EXISTS "attendee_status";
--> statement-breakpoint
DROP TYPE IF EXISTS "age_restriction";
--> statement-breakpoint
DROP TYPE IF EXISTS "photo_policy";
--> statement-breakpoint
DROP TYPE IF EXISTS "dresscode";
--> statement-breakpoint
DROP TYPE IF EXISTS "stream_status";
