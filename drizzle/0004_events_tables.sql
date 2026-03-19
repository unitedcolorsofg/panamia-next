-- Migration: 0004_events_tables
-- Purpose: Create 6 new tables for the Events module (venues, events,
--          eventOrganizers, eventAttendees, eventNotes, eventPhotos)
--          and add eventId FK to social_statuses.
-- Ticket: N/A
-- Reversible: Yes
--
-- Rollback:
--   ALTER TABLE "social_statuses" DROP COLUMN IF EXISTS "event_id";
--   DROP TABLE IF EXISTS "event_photos", "event_notes", "event_attendees",
--     "event_organizers", "events", "venues";
--
-- Dependencies: 0003_events_enums (all enums must exist before tables)
-- =============================================================================

--> statement-breakpoint
CREATE TABLE "venues" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "address" text NOT NULL,
  "city" text NOT NULL,
  "state" text NOT NULL,
  "country" text NOT NULL DEFAULT 'US',
  "postal_code" text,
  "lat" numeric(10, 7),
  "lng" numeric(10, 7),
  "capacity" integer,
  "parking_options" "parking_options" NOT NULL DEFAULT 'none',
  "operator_profile_id" text NOT NULL,
  "status" "venue_status" NOT NULL DEFAULT 'pending_review',
  "safety_contact" jsonb,
  "accessibility_notes" text,
  "photos" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "website" text,
  "suspended_at" timestamp with time zone,
  "suspended_by" text,
  "suspension_reason" text,
  "approved_at" timestamp with time zone,
  "approved_by" text,
  CONSTRAINT "venues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "events" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "cover_image" text,
  "host_profile_id" text NOT NULL,
  "venue_id" text NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone,
  "timezone" text NOT NULL DEFAULT 'America/New_York',
  "status" "event_status" NOT NULL DEFAULT 'draft',
  "visibility" "event_visibility" NOT NULL DEFAULT 'public',
  "attendee_cap" integer,
  "attendee_count" integer NOT NULL DEFAULT 0,
  "age_restriction" "age_restriction" NOT NULL DEFAULT 'all_ages',
  "photo_policy" "photo_policy" NOT NULL DEFAULT 'allowed',
  "dresscode" "dresscode" NOT NULL DEFAULT 'none',
  "ical_uid" text NOT NULL,
  "panamia_co_organizer" boolean NOT NULL DEFAULT true,
  "tos_accepted_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "cancelled_by" text,
  "cancellation_reason" text,
  "stream_eligible" boolean NOT NULL DEFAULT false,
  "stream_status" "stream_status" NOT NULL DEFAULT 'offline',
  "cf_stream_id" text,
  "cf_stream_playback_id" text,
  "cf_stream_srt_url" text,
  "cf_stream_srt_key" text,
  "cf_stream_recording_url" text,
  "stream_live_at" timestamp with time zone,
  "stream_ended_at" timestamp with time zone,
  CONSTRAINT "events_slug_unique" UNIQUE("slug"),
  CONSTRAINT "events_ical_uid_unique" UNIQUE("ical_uid"),
  CONSTRAINT "events_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT,
  CONSTRAINT "events_host_profile_id_fk" FOREIGN KEY ("host_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE "event_organizers" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "event_id" text NOT NULL,
  "profile_id" text NOT NULL,
  "role" "organizer_role" NOT NULL,
  "can_see_rsvp_list" boolean NOT NULL DEFAULT false,
  "invited_by" text,
  "invited_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "declined_at" timestamp with time zone,
  "message" text,
  CONSTRAINT "event_organizers_event_profile_unique" UNIQUE("event_id", "profile_id"),
  CONSTRAINT "event_organizers_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
  CONSTRAINT "event_organizers_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE "event_attendees" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "event_id" text NOT NULL,
  "profile_id" text NOT NULL,
  "status" "attendee_status" NOT NULL,
  "invited_by" text,
  "responded_at" timestamp with time zone,
  CONSTRAINT "event_attendees_event_profile_unique" UNIQUE("event_id", "profile_id"),
  CONSTRAINT "event_attendees_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
  CONSTRAINT "event_attendees_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE "event_notes" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "event_id" text NOT NULL,
  "author_profile_id" text NOT NULL,
  "content" text NOT NULL,
  "audience" text NOT NULL DEFAULT 'all',
  CONSTRAINT "event_notes_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
  CONSTRAINT "event_notes_author_profile_id_fk" FOREIGN KEY ("author_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE "event_photos" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "event_id" text NOT NULL,
  "uploader_profile_id" text NOT NULL,
  "url" text NOT NULL,
  "caption" text,
  "approved" boolean NOT NULL DEFAULT false,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  CONSTRAINT "event_photos_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
  CONSTRAINT "event_photos_uploader_profile_id_fk" FOREIGN KEY ("uploader_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);
--> statement-breakpoint

-- Add eventId FK to social_statuses
ALTER TABLE "social_statuses" ADD COLUMN "event_id" text REFERENCES "events"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- Indexes for venues
CREATE UNIQUE INDEX "venues_slug_idx" ON "venues"("slug");
CREATE INDEX "venues_operator_profile_id_idx" ON "venues"("operator_profile_id");
CREATE INDEX "venues_status_idx" ON "venues"("status");
CREATE INDEX "venues_city_state_idx" ON "venues"("city", "state");
--> statement-breakpoint

-- Indexes for events
CREATE UNIQUE INDEX "events_slug_idx" ON "events"("slug");
CREATE INDEX "events_host_profile_id_idx" ON "events"("host_profile_id");
CREATE INDEX "events_venue_id_idx" ON "events"("venue_id");
CREATE INDEX "events_status_visibility_idx" ON "events"("status", "visibility");
CREATE INDEX "events_starts_at_idx" ON "events"("starts_at");
CREATE UNIQUE INDEX "events_ical_uid_idx" ON "events"("ical_uid");
--> statement-breakpoint

-- Indexes for event_organizers
CREATE INDEX "event_organizers_event_id_idx" ON "event_organizers"("event_id");
CREATE INDEX "event_organizers_profile_id_idx" ON "event_organizers"("profile_id");
--> statement-breakpoint

-- Indexes for event_attendees
CREATE INDEX "event_attendees_event_status_idx" ON "event_attendees"("event_id", "status");
CREATE INDEX "event_attendees_profile_id_idx" ON "event_attendees"("profile_id");
--> statement-breakpoint

-- Indexes for event_notes
CREATE INDEX "event_notes_event_created_idx" ON "event_notes"("event_id", "created_at");
CREATE INDEX "event_notes_author_profile_id_idx" ON "event_notes"("author_profile_id");
--> statement-breakpoint

-- Indexes for event_photos
CREATE INDEX "event_photos_event_approved_idx" ON "event_photos"("event_id", "approved");
CREATE INDEX "event_photos_uploader_profile_id_idx" ON "event_photos"("uploader_profile_id");
--> statement-breakpoint

-- Index for social_statuses.event_id
CREATE INDEX "social_statuses_event_id_idx" ON "social_statuses"("event_id");
