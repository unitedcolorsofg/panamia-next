-- Migration: 0035_profile_owners
-- Purpose: Separate "who administers a listing" from "whose identity this is".
--
--          Until now the only link between a human and a profile was
--          profiles.user_id, which is UNIQUE. That made the relationship 1:1
--          and conflated two different ideas: a person's own profile, and a
--          business listing that person happens to run. One human could never
--          run two businesses, and co-owners had to share a password.
--
--          profile_owners is the ownership layer. profiles.user_id keeps its
--          current meaning and its UNIQUE constraint — it is the human's own
--          identity profile, and ~70 files read it that way. Business listings
--          leave user_id NULL permanently and are administered purely through
--          rows in this table, which is what lets one human hold many.
--
--          Every existing linked profile is backfilled with an 'owner' row so
--          that "can this user edit this profile?" has one answer everywhere
--          from day one, rather than two code paths that can disagree.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: profiles, users. 0022_make_profile_user_id_nullable.
-- Data Migration: Inline. Idempotent — the unique index + ON CONFLICT make
--                 re-runs a no-op.
--
-- Rollback:
--   DROP TABLE IF EXISTS "profile_owners";
--   DROP TYPE IF EXISTS "profile_owner_role";
-- =============================================================================

-- 1. Roles are ordered by power: owner can transfer/delete, admin can manage
--    content and other editors, editor can only edit the listing itself.
DO $$ BEGIN
  CREATE TYPE "profile_owner_role" AS ENUM ('owner', 'admin', 'editor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "profile_owners" (
  "id" text PRIMARY KEY,
  "profile_id" text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" "profile_owner_role" NOT NULL DEFAULT 'owner',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- A user holds at most one role per profile; this is also what makes the
-- backfill below and every future claim idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS "profile_owners_profile_user_unique"
  ON "profile_owners" ("profile_id", "user_id");
--> statement-breakpoint

-- "What do I run?" — the dashboard query.
CREATE INDEX IF NOT EXISTS "profile_owners_user_idx"
  ON "profile_owners" ("user_id");
--> statement-breakpoint

-- "Who runs this?" — the permission check and the claimed/unclaimed test.
CREATE INDEX IF NOT EXISTS "profile_owners_profile_idx"
  ON "profile_owners" ("profile_id");
--> statement-breakpoint

-- 2. Backfill. Every profile already attached to a user becomes an explicit
--    owner row. created_at is carried over from the profile so the ownership
--    history reads truthfully rather than showing everyone claiming at once.
INSERT INTO "profile_owners" ("id", "profile_id", "user_id", "role", "created_at")
SELECT gen_random_uuid()::text, "id", "user_id", 'owner', "created_at"
FROM "profiles"
WHERE "user_id" IS NOT NULL
ON CONFLICT ("profile_id", "user_id") DO NOTHING;
