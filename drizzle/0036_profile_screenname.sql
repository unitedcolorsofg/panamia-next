-- Migration: 0036_profile_screenname
-- Purpose: Move the handle namespace onto profiles so a business listing can
--          own a handle without being attached to a user. Today handles live
--          only on users.screenname, which means the ActivityPub actor builder
--          (lib/federation/wrappers/actor.ts) hard-requires profile.user and a
--          claimed business listing — which has user_id NULL by design — can
--          never get an actor, a NIP-05 address, or followers.
--
--          The namespace is FLAT: /p/:handle and acct:handle@domain resolve
--          humans and businesses through the same path, so a single handle
--          cannot be held by both a user and a profile at once. The uniqueness
--          here covers profiles; lib/screenname.ts enforces the union against
--          users and screenname_history.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: profiles, users (0000_initial_schema); 0035_profile_owners
-- Data Migration: Inline — backfills from users.screenname for linked profiles.
--                 profiles.user_id is UNIQUE and users.screenname is UNIQUE, so
--                 the backfill is strictly 1:1 and cannot produce a collision.
--
-- Rollback:
--   DROP INDEX IF EXISTS profiles_screenname_lower_unique;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS screenname;
--
-- =============================================================================

-- Nullable: a listing created through /form/list-your-business has no handle
-- until somebody claims it and picks one. Unclaimed rows stay NULL.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "screenname" text;
--> statement-breakpoint

-- Case-insensitive uniqueness. Partial so the many NULL (unclaimed) rows are
-- not forced to compete for a single NULL slot.
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_screenname_lower_unique"
  ON "profiles" (lower("screenname"))
  WHERE "screenname" IS NOT NULL;
--> statement-breakpoint

-- Backfill: every profile already linked to a user adopts that user's handle,
-- so existing federation identities keep resolving after the resolvers flip to
-- reading profiles first. Idempotent — only fills rows that are still NULL.
UPDATE "profiles" p
SET "screenname" = u."screenname"
FROM "users" u
WHERE p."user_id" = u."id"
  AND p."screenname" IS NULL
  AND u."screenname" IS NOT NULL;
