-- Migration: 0063_job_runs
-- Purpose: Give the scheduled jobs a written history, so that "is the
--          machinery working" becomes a question somebody can answer.
--
-- Ticket: N/A
-- Reversible: Yes
--
-- Purpose (continued):
--
--          ## The state this is fixing
--
--          worker/index.ts runs an hourly sweep and then does this with the
--          result:
--
--              console.log('[purge]', event.cron, JSON.stringify(report));
--
--          That line is the entire record. Reading it means opening the
--          Cloudflare dashboard, finding the Worker, and scrolling live logs
--          that are not retained -- so in practice nobody has ever read it,
--          and nothing in the product can.
--
--          Three failures are invisible today, in increasing order of how
--          badly they end:
--
--          1. The sweep reports storiesDeferred > 0. That means R2 refused a
--             delete, so an expired story's photo is still in the bucket and
--             the row pointing at it was deliberately left in place to retry.
--             Self-healing if R2 recovers; an unbounded bill and a growing
--             table of invisible rows if it does not.
--
--          2. The sweep throws. The handler rethrows, so Cloudflare records a
--             failed invocation -- visible, but only to somebody already
--             looking at Cloudflare.
--
--          3. The cron stops firing. Nothing throws, nothing logs, nothing
--             anywhere changes. This is the worst one and the only evidence
--             is an absence.
--
--          ## Why this table cannot answer (3) on its own
--
--          A ledger records runs that happened. The run that never happens
--          writes no row, so after the cron stops this table does not fill up
--          with failures -- it simply stops growing, and every row still in
--          it says "fine".
--
--          The answer is therefore not in a column but in the gap between
--          now() and the newest started_at. /admin/livesite treats that gap
--          as the primary alarm and the ok flag as secondary, because a job
--          that is not running cannot report that it is failing. The index
--          below exists to make that one question cheap.
--
--          ## Why job is a free text column
--
--          Only the purge writes here today. Email sends and Nostr crossposts
--          are the obvious next writers, and neither should need a migration
--          to start -- an enum would make adding a job a schema change, which
--          is exactly the friction that keeps things unlogged. The CHECK
--          guards the empty string, which is the only value that would make a
--          row meaningless.
--
--          ## Why both finished_at and ok
--
--          They answer different questions and the difference is the point.
--
--              finished_at IS NULL  ->  the run never came back
--              ok = false           ->  the run came back and said it failed
--
--          The first is a Worker killed mid-flight: CPU budget exceeded,
--          isolate evicted, deploy mid-run. Nothing in the job's own code
--          gets to execute, so a single-row-written-at-the-end design would
--          record that case as indistinguishable from "never ran at all".
--          That is why a row is written when the run *starts* and updated
--          when it ends, at the cost of one extra statement per hour.
--
--          ok is nullable rather than defaulted so that the in-flight state
--          is explicit. NULL means running or dead, never "succeeded".
--
--          ## Why error_count is a column when errors are already in report
--
--          report holds PurgeReport verbatim, errors array and all. The count
--          is lifted out so that "how many bad runs today" is an ordinary
--          integer predicate instead of jsonb extraction, and so it stays
--          answerable if the report shape changes under it -- which it will,
--          since the shape belongs to whichever job wrote the row.
--
--          ## Retention
--
--          Hourly, so 24 rows a day and 720 at the 30-day horizon the ledger
--          trims to. Trimming is done by the job itself in lib/jobs/ledger.ts
--          rather than by a second scheduled task, on the same principle the
--          purge already follows: a cleanup that needs its own cleanup has
--          not finished the job.
--
-- Dependencies: None. Deliberately no FK to anything -- a run is a fact about
--               a moment, and nothing it touched should be able to delete it.
--
-- Data Migration: None. There is no prior history to backfill; the console
--                 logs are not retained and inventing rows would put
--                 confident green ticks against hours nobody can vouch for.
--                 The table starts empty and /admin/livesite says so.
--
-- Deploy ordering: Apply before or after the application revision; both are
--   safe. The writer (lib/jobs/ledger.ts) swallows its own failures so the
--   sweep still runs against an unmigrated database, and the reader
--   (lib/admin/livesite.ts) treats undefined_table as "not migrated yet"
--   rather than an error. This is not belt-and-braces: migrations have twice
--   reached production unapplied here (see scripts/check-pending-migrations.ts),
--   and a ledger that could take the hourly purge down with it would be a
--   strictly worse trade than no ledger at all.
--
-- Rollback:
--   DROP TABLE IF EXISTS "job_runs";
-- =============================================================================

CREATE TABLE IF NOT EXISTS "job_runs" (
  "id" text PRIMARY KEY,
  -- Which job. Free text on purpose; see the header.
  "job" text NOT NULL,
  -- The cron expression that fired it, or 'manual'. Distinguishes a schedule
  -- that is working from one somebody has been quietly running by hand.
  "trigger" text NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- NULL means the run never came back. See the header.
  "finished_at" timestamp with time zone,
  -- NULL while in flight. Never defaulted: an unfinished run must not read as
  -- a successful one.
  "ok" boolean,
  -- The job's own report, verbatim. Shape belongs to the job that wrote it.
  "report" jsonb,
  "error_count" integer DEFAULT 0 NOT NULL,

  CONSTRAINT "job_runs_job_not_blank"
    CHECK (length(btrim("job")) > 0),
  CONSTRAINT "job_runs_error_count_non_negative"
    CHECK ("error_count" >= 0)
);

-- The only read this table has: "the newest run of this job", and counts over
-- a recent window for the same job. Composite and descending because the
-- staleness check -- the primary alarm -- is the first row of this index.
CREATE INDEX IF NOT EXISTS "job_runs_job_started_at_idx"
  ON "job_runs" ("job", "started_at" DESC);
