-- =============================================================================
-- Migration: 0050_social_blocks
-- Purpose: Block and mute. Pana Social has no follow approval step — anyone may
--          follow anyone and it is accepted immediately — which is the right
--          default for a network whose point is local connection, but it means
--          "no approval" becomes "no recourse" unless there is an escape hatch.
--          This is that hatch. In a geographically local network it matters
--          more than in a global one: avoiding an ex, a harasser or a former
--          employer is a safety need about people you will physically meet.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: social_actors
-- Data Migration: None (new table only)
--
-- Rollback:
--   DROP TABLE IF EXISTS "social_blocks";
--   DROP TYPE IF EXISTS "social_block_kind";
--
-- One table with a `kind` discriminator rather than two tables. Every read path
-- asks the same question — "is there anything between these two actors" — and
-- one indexed lookup answers it for both tools. Two tables would double every
-- subtraction in the feed, suggestion and notification queries.
--
-- The two kinds are genuinely different tools, not strengths of one setting:
--
--   block   severs follows in both directions, prevents re-following, and
--           removes each actor from the other's view. Safety.
--   mute    touches no follow at all and changes only what the muting actor
--           sees. "I like you, I cannot take your posting volume." Mute is the
--           one people reach for most, and the one that keeps a small community
--           livable, because it lets somebody stay connected to a neighbour
--           they will see at the next block party.
--
-- Neither is announced to the other party.
--
-- UNIQUE (actor_id, target_actor_id, kind) rather than (actor_id,
-- target_actor_id): muting someone and later blocking them is an ordinary
-- sequence, and the mute row should not have to be destroyed to record the
-- block. It also means "unblock" does not silently unmute.
--
-- Both directions are indexed because both are read. actor_id answers "who
-- have I blocked" when building my feed; target_actor_id answers "who has
-- blocked me", which is what stops a blocked actor from seeing the blocker
-- through search, suggestions or a follower list.
--
-- Enforcement is LOCAL ONLY and that is deliberate. ActivityPub has a Block
-- activity, but remote servers may ignore it and delivering one announces the
-- block to the instance you are trying to get away from. We control what this
-- server shows and delivers; the UI says so rather than implying more. Same
-- honesty as PRIVACY-ROADMAP.md's note that remote servers may ignore Delete.
-- =============================================================================

CREATE TYPE "social_block_kind" AS ENUM ('block', 'mute');
--> statement-breakpoint

CREATE TABLE "social_blocks" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "actor_id" text NOT NULL REFERENCES "social_actors"("id") ON DELETE CASCADE,
  "target_actor_id" text NOT NULL REFERENCES "social_actors"("id") ON DELETE CASCADE,
  "kind" "social_block_kind" NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "social_blocks_actor_target_kind_unique"
  ON "social_blocks" ("actor_id", "target_actor_id", "kind");
--> statement-breakpoint

CREATE INDEX "social_blocks_actor_id_idx"
  ON "social_blocks" ("actor_id");
--> statement-breakpoint

CREATE INDEX "social_blocks_target_actor_id_idx"
  ON "social_blocks" ("target_actor_id");
