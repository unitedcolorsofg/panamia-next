-- Migration: 0055_event_dismissals
-- Purpose: Store "not for me" corrections from the events discovery page.
--
--          /e now states why each event is in front of you -- a host you
--          follow, panas going, tags like something you turned up to. A stated
--          reason has to be arguable or it is decoration, so every card carries
--          a dismissal control, and the banner it raises says what the page
--          took from it ("fewer from Barrio Arts Lab").
--
--          That claim is about the future, so it needs somewhere to live.
--          Held in component state the card reappears on the next navigation
--          while the copy goes on promising it learned something, which is
--          worse than having no control at all: it trains panas that the
--          feedback is theatre. This table is what makes the sentence true.
--
--          reason_kind records what the page claimed when the pana disagreed,
--          not a category of dislike. "Shown because your panas are going, and
--          told no" is a different signal from "shown because it matched your
--          tags, and told no" -- only the first is evidence about people rather
--          than subject matter. Without it every correction collapses into an
--          undifferentiated downvote.
-- Ticket: N/A
-- Reversible: Yes -- see Rollback. New table only; nothing existing is altered.
--
-- Dependencies: profiles, events (0000_initial_schema, 0047 event host CHECK)
--
-- Data Migration: None. New table, starts empty.
--
-- Deploy ordering: Backwards compatible in both directions. An older revision
--   has never heard of this table and is unaffected; the new page degrades to
--   showing everything if the table is missing, because an absent dismissal is
--   indistinguishable from "nothing hidden yet". Safe to deploy before or
--   after the application revision.
--
-- Privacy: A dismissal is a statement a pana made to the page about
--   themselves, and is never shown to anyone else -- not to the host whose
--   event was hidden, not in an attendee list, not in a count. The ON DELETE
--   CASCADE on profile_id is what makes "delete my account" also mean "forget
--   what I hid", which is the only correct reading of a preference log.
--
-- Rollback:
--   DROP TABLE IF EXISTS "event_dismissals";
--
-- =============================================================================

CREATE TABLE IF NOT EXISTS "event_dismissals" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "profile_id" text NOT NULL,
  "event_id" text NOT NULL,
  "reason_kind" text
);

DO $$ BEGIN
  ALTER TABLE "event_dismissals" ADD CONSTRAINT "event_dismissals_profile_id_profiles_id_fk"
    FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "event_dismissals" ADD CONSTRAINT "event_dismissals_event_id_events_id_fk"
    FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- One row per pana per event: dismissing twice is the same statement said
-- twice, and an undo that had to delete an unknown number of rows would be a
-- race waiting to happen.
CREATE UNIQUE INDEX IF NOT EXISTS "event_dismissals_profile_event_unique"
  ON "event_dismissals" ("profile_id", "event_id");

-- The read path is always "everything this pana has hidden", once per render.
CREATE INDEX IF NOT EXISTS "event_dismissals_profile_id_idx"
  ON "event_dismissals" ("profile_id");
