-- Migration: 0047_event_group_host
-- Purpose: Let a group host an event, the same way a business hosts one today.
--
--          A group-hosted event is hosted by the *group*, not by the pana who
--          filled in the form. That distinction is the whole point rather than
--          a detail: `lib/server/delete-account.ts` blocks account deletion
--          while you host upcoming events ("Cancel or transfer them first")
--          and deletes your completed ones on the 'anonymize' path. If a
--          group's events hung off the founder's profile, the club would lose
--          its monthly swap the day the founder left, and every departure
--          would be gated on events the person did not personally own.
--
--          With host_profile_id NULL on group-hosted rows, those queries stop
--          matching them, so the group keeps both its upcoming and its past
--          events and the founder is free to go.
--
-- Ticket: docs/GROUPS-ROADMAP.md - Phase 5
-- Reversible: Partial. The column and CHECK drop cleanly, but restoring
--             NOT NULL on host_profile_id first requires deciding what profile
--             inherits each group-hosted event, which is a product question
--             and not a mechanical rollback. Reverse only while no
--             group-hosted event exists.
--
-- Rollback:
--   ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_single_host";
--   DROP INDEX IF EXISTS "events_host_group_id_idx";
--   ALTER TABLE "events" DROP COLUMN IF EXISTS "host_group_id";
--   -- Only safe while no row has host_profile_id IS NULL:
--   ALTER TABLE "events" ALTER COLUMN "host_profile_id" SET NOT NULL;

-- RESTRICT, matching host_profile_id: a group with events cannot be deleted
-- out from under them, and the caller is told rather than silently cascading.
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "host_group_id" text
  REFERENCES "social_groups"("id") ON DELETE RESTRICT;
--> statement-breakpoint

-- 0004 created this NOT NULL, 0011 dropped it for account deletion, and 0025
-- set it again. It comes off once more, but this time the CHECK below carries
-- the guarantee instead, so "every event has a host" survives the change.
ALTER TABLE "events" ALTER COLUMN "host_profile_id" DROP NOT NULL;
--> statement-breakpoint

-- Exactly one host, never zero and never both. Without this, DROP NOT NULL
-- above would permit a hostless event and every consumer of `events` would
-- grow a defensive branch for a state that should be impossible.
ALTER TABLE "events"
  ADD CONSTRAINT "events_single_host" CHECK (
    ("host_profile_id" IS NOT NULL AND "host_group_id" IS NULL) OR
    ("host_profile_id" IS NULL AND "host_group_id" IS NOT NULL)
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "events_host_group_id_idx"
  ON "events" ("host_group_id");
