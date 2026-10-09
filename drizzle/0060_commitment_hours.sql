-- Migration: 0059_commitment_hours
-- Purpose: Give a commitment an estimated size, so the programme can see how
--          much each connector is actually carrying before putting more on
--          them.
-- Ticket: N/A
-- Reversible: Yes
--
-- Purpose (continued):
--
--          The scheduling view needs to answer "who has room this month".
--          Counting rows cannot answer it: "drop off zines at four shops" and
--          "run the Saturday workshop series" are both one row, and a person
--          holding three of the first has far more room than a person holding
--          one of the second. Without a size, a load table would rank people
--          by how finely they happen to write things down.
--
-- Dependencies: connector_commitments (0056).
-- Data Migration: None. See below.
--
-- Rollback:
--   ALTER TABLE "connector_commitments"
--     DROP CONSTRAINT IF EXISTS "connector_commitments_estimated_minutes_check";
--   ALTER TABLE "connector_commitments" DROP COLUMN IF EXISTS "estimated_minutes";
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Why minutes, and not hours
-- ---------------------------------------------------------------------------
-- People say "half an hour" and "an hour and a half", so the column has to
-- hold halves. The obvious shape is numeric(4,1), and it is the wrong one
-- twice over: the pg driver hands numeric back as a *string*, so every sum
-- would be parsed and re-serialised on the way through, and comparing or
-- totalling decimal estimates invites the rounding drift that makes a load
-- table disagree with the rows under it.
--
-- Integer minutes make the arithmetic exact and let SUM() be trusted
-- literally. The UI talks in hours and converts at the edge, which is the one
-- place a human ever sees the number.
--
-- ---------------------------------------------------------------------------
-- Why nullable, and why nothing is backfilled
-- ---------------------------------------------------------------------------
-- Every row that exists today was written without anybody being asked how long
-- it would take. There is no answer to recover and no average worth inventing:
-- a default of two hours would make a connector carrying six unestimated
-- errands look like a twelve-hour commitment they never agreed to, and the
-- scheduling page would route work away from them on the strength of a number
-- this migration made up.
--
-- So NULL means "nobody has said", and it is a state the UI reports rather
-- than hides. An unestimated commitment is counted in the row count and
-- excluded from the hour total, and the page says so next to the figure. That
-- is honest in both directions: the total is never inflated by guesses, and
-- the reader is told the total is incomplete instead of trusting a number that
-- quietly omits half of somebody's board.
ALTER TABLE "connector_commitments"
  ADD COLUMN IF NOT EXISTS "estimated_minutes" integer;

-- A zero-minute commitment is not a commitment, and a negative one is a typo
-- that would silently subtract from somebody's load and make them look free.
-- The ceiling is 100 hours: high enough that no honest estimate hits it, low
-- enough that a slipped keypress turning 2 into 2000 is rejected at the
-- database rather than rendered as a connector carrying eleven months of work.
ALTER TABLE "connector_commitments"
  ADD CONSTRAINT "connector_commitments_estimated_minutes_check"
  CHECK (
    "estimated_minutes" IS NULL
    OR ("estimated_minutes" > 0 AND "estimated_minutes" <= 6000)
  );

COMMENT ON COLUMN "connector_commitments"."estimated_minutes" IS
  'Rough size of this commitment in minutes. NULL means nobody has estimated it -- a real state the scheduling view reports rather than treating as zero. Minutes rather than decimal hours so SUM() is exact; the UI converts at the edge.';
