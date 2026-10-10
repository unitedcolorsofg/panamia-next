-- =============================================================================
-- Migration: 0053_social_reports
-- Purpose: In-app abuse reporting for Pana Social content.
--
--          0050 gave members block and mute, which are the tools for removing
--          somebody from *your own* view. Neither tells anyone at Pana MIA that
--          a problem exists. Until now the only reports that reached the
--          moderation queue were NIP-56 kind 1984 events forwarded from
--          relay.pana.social (see relay_reports), and those can only describe
--          Nostr content signed by a Nostr key. An ordinary member reading the
--          timeline in the app has no pubkey, is looking at a social_statuses
--          row that has no Nostr event id, and so had no way to say "this is
--          abusive" to anybody but themselves.
--
--          That gap is also an App Store problem. Guideline 1.2 requires apps
--          with user-generated content to ship ALL of: a method for filtering
--          objectionable material, a mechanism for users to flag objectionable
--          content, the ability to block abusive users, and published contact
--          information. We had three of the four. This is the fourth.
--
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: social_actors
-- Data Migration: None (new table only)
--
-- Rollback:
--   DROP TABLE IF EXISTS "social_reports";
--   DROP TYPE IF EXISTS "social_report_reason";
--   DROP TYPE IF EXISTS "social_report_status";
--
-- -----------------------------------------------------------------------------
-- Why a new table instead of reusing relay_reports
--
-- relay_reports is Nostr-shaped all the way down: reporter_pubkey and
-- target_pubkey are NOT NULL-checked hex64 x-only keys, target_event_id is a
-- kind 1984 event id, and the row's whole premise (stated in the route
-- docblock) is that "the report is already a durable public NIP-56 event on
-- the relay regardless". None of that is true of a report raised from the app
-- against a social_statuses row. Forcing app reports into that table would
-- mean inventing fake hex ids to satisfy the dedup index and would quietly
-- break the admin console's assumption that every row can be actioned by
-- deleting an event from the relay.
--
-- The two queues stay separate for the same reason the two report *sources*
-- are separate: a moderator acting on a relay report deletes an event from
-- Nostr; a moderator acting on a social report hides or removes a row in our
-- own database. Different levers, different terminal states.
--
-- -----------------------------------------------------------------------------
-- Why the FKs are ON DELETE SET NULL and the row carries snapshots
--
-- Reports have to outlive the accounts and the content they concern. This is
-- already the stated policy in app/legal/terms ("Abuse reports are retained
-- after account deletion") and is the only way a pattern of behaviour across
-- several since-deleted posts stays visible to a moderator.
--
-- CASCADE would mean the cheapest way to clear the moderation queue against
-- you is to delete the reported post, which is exactly backwards. So every
-- foreign key here is SET NULL, and the columns that matter for triage --
-- who reported, who was reported, and what the content actually said -- are
-- ALSO stored denormalised on the row. A report whose target deleted their
-- account still reads as a complete sentence in the admin console.
--
-- reported_content is a snapshot taken at report time for the same reason
-- relay_reports.reported_content is: the moderator must see what the reporter
-- saw, not whatever the post was later edited into, and not an empty box
-- because the post is gone.
--
-- -----------------------------------------------------------------------------
-- Why the dedup index uses COALESCE
--
-- Postgres treats NULLs as distinct in a UNIQUE index, so a plain UNIQUE on
-- (reporter, target, target_status_id, reason) would dedup reports about a
-- *post* but not reports about an *account*, where target_status_id is NULL --
-- the one case where a frustrated reporter is most likely to tap twice.
-- COALESCE(target_status_id, '') collapses that to a real value so both cases
-- dedup identically. NULLS NOT DISTINCT would be the modern spelling but is
-- Postgres 15+, and this migration should not carry a version floor.
--
-- As in relay_reports, this is queue readability and not an abuse control.
--
-- The index is PARTIAL on the two actor foreign keys, both of which are
-- ON DELETE SET NULL. When an account is deleted every report it is party to
-- collapses to the same NULL key, so a full index would raise a duplicate-key
-- error on the *second* such deletion and make a reported account impossible
-- to delete. Dedup only needs to hold while the reporter still exists -- a
-- deleted account cannot tap "report" twice -- so restricting the index to
-- live rows costs nothing and removes the failure mode entirely.
--
-- -----------------------------------------------------------------------------
-- Why target_status_id is not an FK
--
-- It was ON DELETE SET NULL in the first draft, which was wrong twice over.
--
-- Mechanically, it deadlocks against the dedup index: report a post for spam,
-- report the same account for spam, then delete the post, and SET NULL turns
-- the first row into a duplicate of the second. Postgres refuses, the DELETE
-- fails, and the post cannot be removed -- including by a moderator trying to
-- remove it *because* it was reported.
--
-- Semantically, it is worse. SET NULL rewrites a report about one specific
-- post into a row indistinguishable from a report about the whole account,
-- destroying the single most useful fact on it. The reported_content snapshot
-- would survive while the row around it quietly started lying.
--
-- So the column keeps the status id as a plain historical reference. Nothing
-- rewrites it, nothing cascades through it, and a report still names the post
-- it was about long after that post is gone. Referential integrity is not
-- wanted here: the whole point is that reports outlive what they describe.
-- =============================================================================

-- Declaration order is load-bearing: Postgres sorts enum columns by
-- declaration order, so `orderBy: asc(status)` floats open (unhandled) reports
-- to the top of the admin queue. Same convention as contact_submission_status
-- and relay_report_status.
CREATE TYPE "social_report_status" AS ENUM ('open', 'actioned', 'dismissed');
--> statement-breakpoint

-- What the reporter says is wrong. An enum rather than free text because this
-- set is ours (unlike NIP-56's drifting report types, which is why
-- relay_reports.report_type is plain text) and because the admin queue needs
-- to be filterable by it.
--
-- 'csam' is deliberately its own value rather than being folded into
-- 'sexual_content'. It is the one category with a mandatory external reporting
-- obligation -- NCMEC/CyberTipline, already named in app/legal/terms -- and a
-- moderator must be able to find those rows without reading every report.
CREATE TYPE "social_report_reason" AS ENUM (
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'self_harm',
  'sexual_content',
  'csam',
  'impersonation',
  'other'
);
--> statement-breakpoint

CREATE TABLE "social_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,

  -- Who reported. SET NULL so the report survives the reporter deleting their
  -- account; reporter_handle keeps the queue readable afterwards.
  "reporter_actor_id" text REFERENCES "social_actors"("id") ON DELETE SET NULL,
  "reporter_handle" text,

  -- Who was reported. Always set at insert time, even when the report is about
  -- a single post, so "show me everything about this account" is one query.
  "target_actor_id" text REFERENCES "social_actors"("id") ON DELETE SET NULL,
  "target_handle" text,

  -- The reported post, or NULL when the report is about the account itself.
  --
  -- Deliberately NOT a foreign key -- see "Why target_status_id is not an FK".
  "target_status_id" text,

  "reason" "social_report_reason" NOT NULL,
  -- The reporter's own words. Optional: making it mandatory would mostly
  -- produce "." and would slow down the person least able to type calmly.
  "details" text NOT NULL DEFAULT '',
  -- Snapshot of the reported post at report time. NULL for account reports.
  "reported_content" text,

  "status" "social_report_status" NOT NULL DEFAULT 'open',
  "moderation_reason" text,
  "last_moderation_action_at" timestamp with time zone
);
--> statement-breakpoint

CREATE UNIQUE INDEX "social_reports_dedup_idx"
  ON "social_reports" (
    "reporter_actor_id",
    "target_actor_id",
    COALESCE("target_status_id", ''),
    "reason"
  )
  WHERE "reporter_actor_id" IS NOT NULL AND "target_actor_id" IS NOT NULL;
--> statement-breakpoint

-- The admin queue's default read: open reports, oldest first.
CREATE INDEX "social_reports_status_created_idx"
  ON "social_reports" ("status", "created_at");
--> statement-breakpoint

-- "Everything ever reported about this account", which is the question a
-- moderator asks before deciding whether a single report is a pattern.
CREATE INDEX "social_reports_target_actor_id_idx"
  ON "social_reports" ("target_actor_id");
--> statement-breakpoint

CREATE INDEX "social_reports_target_status_id_idx"
  ON "social_reports" ("target_status_id");
