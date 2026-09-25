-- Migration: 0044_social_groups
-- Purpose: Let panas gather around an interest instead of only around each
--          other. Groups are the first thing in the social module that is
--          followable but is not a person, so this adds an actor type, the
--          group itself, and its roster.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: social_actors, profiles.
-- Data Migration: None. Both tables start empty, and the new social_actors
--                 column backfills from its own DEFAULT, which is the value
--                 the actor route was hardcoding for every existing row.
--
-- Rollback:
--   DROP TABLE IF EXISTS "social_group_members";
--   DROP TABLE IF EXISTS "social_groups";
--   DROP TYPE IF EXISTS "social_group_member_status";
--   DROP TYPE IF EXISTS "social_group_role";
--   DROP TYPE IF EXISTS "social_group_join_policy";
--   DROP TYPE IF EXISTS "social_group_visibility";
--   ALTER TABLE "social_actors" DROP COLUMN IF EXISTS "type";
--
-- =============================================================================
-- Design notes
-- =============================================================================
--
-- A group is not a new kind of account sitting beside actors — it IS an actor,
-- given a row in social_actors with type='Group'. That is the whole reason for
-- the type column: the federation code already knows how to sign, address,
-- deliver to and resolve an actor, and a parallel "group delivery" path would
-- have to reimplement all of it and then drift from it. ActivityPub has had a
-- Group actor type since the spec shipped, so remote servers already know what
-- to do with one.
--
-- Before this migration app/api/federation/actor/[user]/route.ts served the
-- string 'Person' as a literal. The column defaults to 'Person' so every actor
-- that predates it keeps exactly the behaviour it already had, and the route
-- now reads the column.
--
-- social_group_members is keyed on actor_id rather than profile_id. The hot
-- question is "every group this actor belongs to", asked on every timeline
-- fetch to decide which group posts a viewer may see; keying on profiles would
-- put a join on the one query in the app that cannot afford one. It also means
-- a remote actor can join a group without us inventing a local profile for
-- them.
--
-- visibility and join_policy are separate columns because they answer
-- different questions. visibility is "may this viewer read it at all", which
-- every read path must answer before it can return a row. join_policy is "how
-- does someone get in", which only the join endpoint cares about. Deriving one
-- from the other would force read paths to reason about admission rules, and a
-- mistake there leaks a private group's posts rather than merely letting the
-- wrong person in.
--
-- member_count is denormalised because the feed rail renders it next to the
-- Panas count on every page load, and counting rows there puts a query on the
-- hottest path in the product. It counts 'active' rows only — a pending join
-- request is not a member.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE "social_group_visibility" AS ENUM ('public', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "social_group_join_policy" AS ENUM ('open', 'request', 'invite');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "social_group_role" AS ENUM ('admin', 'moderator', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "social_group_member_status" AS ENUM ('active', 'pending', 'banned');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- text, not an enum: this table also holds remote actors, and a remote server
-- may serve an actor type this codebase has never heard of. An enum would
-- reject the INSERT and drop the actor entirely, which is worse than storing a
-- string we do not recognise.
ALTER TABLE "social_actors"
  ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'Person' NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "social_groups" (
  "id" text PRIMARY KEY,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- CASCADE: an actor with no group row is an actor nothing can describe.
  "actor_id" text NOT NULL REFERENCES "social_actors"("id") ON DELETE CASCADE,
  -- SET NULL, not CASCADE: deleting the founder's profile must not delete a
  -- group other people are still using.
  "created_by_profile_id" text REFERENCES "profiles"("id") ON DELETE SET NULL,
  -- A { topic: true } flag map rather than an array, so pana_jsonb_flags from
  -- 0040 can flatten it into a search vector the same way it already does for
  -- profile categories.
  "topics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  -- An array, because house rules are numbered when displayed and order
  -- carries meaning. They are prose, never facets, so they are never searched.
  "rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "visibility" "social_group_visibility" DEFAULT 'public' NOT NULL,
  "join_policy" "social_group_join_policy" DEFAULT 'open' NOT NULL,
  "member_count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "social_groups_actor_id_unique" UNIQUE ("actor_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "social_group_members" (
  "id" text PRIMARY KEY,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "group_id" text NOT NULL REFERENCES "social_groups"("id") ON DELETE CASCADE,
  "actor_id" text NOT NULL REFERENCES "social_actors"("id") ON DELETE CASCADE,
  "role" "social_group_role" DEFAULT 'member' NOT NULL,
  "status" "social_group_member_status" DEFAULT 'active' NOT NULL,
  -- NULL while a request is pending, so "member since" never claims someone
  -- joined on the day they merely asked.
  "joined_at" timestamp with time zone
);
--> statement-breakpoint

-- One row per actor per group. This is also what makes join idempotent: a
-- double-tap on a slow connection cannot inflate member_count or create a
-- second membership at a different role.
CREATE UNIQUE INDEX IF NOT EXISTS "social_group_members_group_actor_unique"
  ON "social_group_members" ("group_id", "actor_id");
--> statement-breakpoint

-- "Every group this actor is in" — the timeline-visibility lookup.
CREATE INDEX IF NOT EXISTS "social_group_members_actor_id_idx"
  ON "social_group_members" ("actor_id");
--> statement-breakpoint

-- Composite rather than group_id alone: it serves both "the roster" and "the
-- pending queue", which are the only two ways this is read per group.
CREATE INDEX IF NOT EXISTS "social_group_members_group_status_idx"
  ON "social_group_members" ("group_id", "status");
