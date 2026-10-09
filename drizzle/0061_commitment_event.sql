-- Purpose: Let a commitment name the event it staffs, so "who is working this"
--          and "what is this person carrying" become the same question asked
--          from two directions.
-- Ticket: connectors-commitment-event-link
-- Reversible: yes. Drop the CHECK, the indexes and the two foreign keys, then
--             the columns. Nothing existing is rewritten, so the way back
--             loses only the links themselves.
--
-- ## Two nullable references, not one polymorphic column
--
-- A commitment can staff a public event (`events`), a programme gathering
-- (`connector_events`), or neither. "Drop off zines at four shops" is still
-- the most common kind of work and has no event at all, so the common case
-- has to stay cheap: both columns NULL, no row anywhere else.
--
-- Two typed FKs rather than an (event_type, event_id) pair because the pair
-- cannot be a foreign key -- the database would stop checking that the thing
-- being pointed at exists, which is the only reason to reference it from here.
-- This mirrors events.host_profile_id / host_group_id and its
-- events_single_host CHECK (drizzle/0047); same shape, same reason.
--
-- ## ON DELETE SET NULL on both
--
-- Deleting an event must not delete the record that somebody was asked to work
-- it. The ask happened, the hours were counted against them, and a connector's
-- board is read as a history. After the event goes the row stays and reads as
-- ordinary unattached work, which is true: there is no longer an event.

ALTER TABLE "connector_commitments"
  ADD COLUMN "event_id" text,
  ADD COLUMN "connector_event_id" text;

ALTER TABLE "connector_commitments"
  ADD CONSTRAINT "connector_commitments_event_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL;

ALTER TABLE "connector_commitments"
  ADD CONSTRAINT "connector_commitments_connector_event_id_fk"
  FOREIGN KEY ("connector_event_id") REFERENCES "connector_events"("id") ON DELETE SET NULL;

-- At most one, deliberately not exactly one. Unattached work is the norm.
ALTER TABLE "connector_commitments"
  ADD CONSTRAINT "connector_commitments_single_event"
  CHECK ("event_id" IS NULL OR "connector_event_id" IS NULL);

-- Both serve the staffing count -- "how many connectors are on this event" --
-- which looks up by event id in a table otherwise keyed by profile.
--
-- Partial, because most rows have no event and indexing their NULLs would pay
-- for entries the staffing query never visits.
CREATE INDEX IF NOT EXISTS "connector_commitments_event_id_idx"
  ON "connector_commitments" ("event_id")
  WHERE "event_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "connector_commitments_connector_event_id_idx"
  ON "connector_commitments" ("connector_event_id")
  WHERE "connector_event_id" IS NOT NULL;
