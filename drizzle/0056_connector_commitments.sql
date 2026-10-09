-- Migration: 0056_connector_commitments
-- Purpose: Move a connector's commitments out of the profiles.connector JSONB
--          blob and into their own table, so that somebody other than the
--          connector can write one.
--
--          0055 put commitments inside the membership blob and was explicit
--          about the condition that made it safe:
--
--            "It is written whole. [...] there is no second writer racing it."
--
--          app/api/connectors/commitments/route.ts repeats it and names the
--          remedy:
--
--            "every writer of this blob is the same single human acting on
--             their own record [...] If a second writer ever appears, this
--             needs to move to its own table rather than grow a lock."
--
--          The admin console is that second writer. The programme asked for
--          staff to be able to set a task for a connector, which means an
--          admin and the connector can now be saving the same blob seconds
--          apart: she marks a commitment done, he assigns her a task, and
--          whichever UPDATE lands second overwrites the other's whole column.
--          Not a corrupted row -- a silently lost one, with no error and
--          nothing in a log to find later.
--
--          So the condition that justified the blob has expired, and this is
--          the move its own authors prescribed.
--
--          There is a second win. With commitments out, the blob stops being
--          written on every progress change. What remains -- status, pod,
--          houses, tier, bring -- changes a handful of times in a membership's
--          life, which is what makes the admin "assign a house" write landing
--          in the same release tolerable on the same column.
--
--          ## Why assigned_by rather than a separate tasks table
--
--          A task set by staff and a commitment made by the connector are the
--          same row with a different origin. Both are "a thing this person is
--          going to do, in a house, by roughly when, at some stage of done".
--          Two tables would duplicate the progress vocabulary, the house
--          reference and every query that asks what somebody is carrying --
--          and HQ would have to merge them to show one list, which is how the
--          two drift.
--
--          assigned_by NULL means the connector wrote it themselves. That is
--          the common case, so it is the cheap one to store, and the presence
--          of a value is exactly the fact the UI needs in order to say who
--          asked.
--
--          Progress stays the connector's to set either way. Staff can put
--          something on your board; they cannot tick it off for you.
--
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: profiles (0055 for the connector column), users.
-- Data Migration: Inline. Existing commitments are copied out of
--                 profiles.connector -> 'commitments' into the new table.
--
--                 The JSONB key is deliberately NOT stripped. This is the
--                 expand half of an expand/contract: the copy is additive and
--                 reversible, the application stops reading the key in the
--                 same release, and the key is dropped by a later migration
--                 once the table has been load-bearing for a while. Stripping
--                 it here would make a code rollback lose real commitments,
--                 which is a steep price for tidiness in a column nothing
--                 will read.
--
--                 Rows with no recognised house are skipped rather than
--                 defaulted into one. parseConnector already discards those,
--                 so they are invisible today; inventing a house for them
--                 during a migration would make them appear for the first
--                 time, in a house nobody picked.
--
-- Rollback:
--   DROP TABLE IF EXISTS "connector_commitments";
--   -- No restore step is needed: the JSONB key was left in place, so the
--   -- previous release reads its own data exactly as it did before.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "connector_commitments" (
  "id" text PRIMARY KEY,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Cascade: commitments describe what this person is doing. With the person
  -- gone there is nobody for them to belong to, and the programme's own
  -- deletion promise is that leaving takes your record with you.
  "profile_id" text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "what" text NOT NULL,
  -- Free text on purpose, and named with a suffix because WHEN is a reserved
  -- word. The programme's own answers are "this month", "before the 14th",
  -- "Saturdays" -- a date picker would force a precision the work does not
  -- have and would turn a soft intention into a missed deadline.
  "when_text" text,
  "house" text NOT NULL,
  "progress" text NOT NULL DEFAULT 'notSet',
  -- NULL means self-authored, which is the ordinary case. A value means staff
  -- put this on somebody's board, and it is kept so the connector can tell
  -- who to ask about it.
  --
  -- SET NULL rather than CASCADE: an admin leaving the organisation must not
  -- delete the work they asked other people to do. The task survives having
  -- lost its requester.
  "assigned_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "assigned_at" timestamp with time zone,
  CONSTRAINT "connector_commitments_progress_check"
    CHECK ("progress" IN ('notSet', 'inProgress', 'done')),
  CONSTRAINT "connector_commitments_house_check"
    CHECK ("house" IN ('education', 'relationshipBuilding', 'narrativeShifters', 'culturalWorkers')),
  -- An assignment has both halves or neither. Without this, a row could claim
  -- a requester with no date or a date with no requester, and the UI would
  -- have to decide which half to believe.
  CONSTRAINT "connector_commitments_assignment_check"
    CHECK (("assigned_by" IS NULL) = ("assigned_at" IS NULL))
);

COMMENT ON TABLE "connector_commitments" IS
  'What a Connectors programme member is doing. One row per commitment. Written by the member from /connectors/hq and by staff from the admin console -- the second writer is why these are not on profiles.connector any more (see drizzle/0056).';

COMMENT ON COLUMN "connector_commitments"."assigned_by" IS
  'The user who set this as a task for the connector. NULL means the connector wrote it themselves.';

-- The only read path: everything this person is carrying, newest last so the
-- board reads in the order it was built.
CREATE INDEX IF NOT EXISTS "connector_commitments_profile_id_idx"
  ON "connector_commitments" ("profile_id", "created_at");

-- The admin console's cross-programme view: every open commitment, so staff
-- can see what the programme as a whole is carrying rather than opening
-- members one at a time. Partial, because 'done' rows accumulate forever and
-- are never what that page is asking about.
CREATE INDEX IF NOT EXISTS "connector_commitments_open_idx"
  ON "connector_commitments" ("created_at")
  WHERE "progress" <> 'done';

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
-- LATERAL over the stored array. Guarded three ways, because this blob was
-- never constrained by the database and may hold anything an older build or a
-- support edit put there:
--
--   jsonb_typeof(...) = 'array'   the key may be absent, null, or an object
--   what <> ''                    parseConnector drops these, so they have
--                                 never been visible and must not start being
--   house IN (...)                same, and the CHECK above would reject them
--
-- createdAt is cast only when it looks like a date, so one malformed string
-- cannot abort the whole migration. Anything unparseable lands at now(),
-- which puts it at the end of somebody's board rather than in 1970.
INSERT INTO "connector_commitments"
  ("id", "created_at", "updated_at", "profile_id", "what", "when_text", "house", "progress")
SELECT
  COALESCE(
    NULLIF(c.value ->> 'id', ''),
    md5(p."id" || COALESCE(c.value ->> 'what', '') || c.ordinality::text)
  ),
  CASE
    WHEN c.value ->> 'createdAt' ~ '^\d{4}-\d{2}-\d{2}'
      THEN (c.value ->> 'createdAt')::timestamptz
    ELSE now()
  END,
  now(),
  p."id",
  btrim(c.value ->> 'what'),
  NULLIF(btrim(COALESCE(c.value ->> 'when', '')), ''),
  c.value ->> 'house',
  CASE
    WHEN c.value ->> 'progress' IN ('notSet', 'inProgress', 'done')
      THEN c.value ->> 'progress'
    ELSE 'notSet'
  END
FROM "profiles" p
CROSS JOIN LATERAL jsonb_array_elements(p."connector" -> 'commitments')
  WITH ORDINALITY AS c(value, ordinality)
WHERE p."connector" IS NOT NULL
  AND jsonb_typeof(p."connector" -> 'commitments') = 'array'
  AND btrim(COALESCE(c.value ->> 'what', '')) <> ''
  AND c.value ->> 'house' IN ('education', 'relationshipBuilding', 'narrativeShifters', 'culturalWorkers')
ON CONFLICT ("id") DO NOTHING;
