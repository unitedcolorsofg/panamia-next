-- =============================================================================
-- Migration: 0048_recommendation_lists
-- Purpose: Recommendation Lists — named, ordered lists of directory listings a
--          pana vouches for, each entry carrying that pana's own note. The note
--          is the feature: the directory can already say a cafe exists, but not
--          that someone you trust orders the same thing there every Tuesday.
--          Replaces the user_lists feature removed in SOCIAL-ROADMAP Phase 3.5,
--          this time built on the social/ActivityPub layer rather than beside it.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: users, profiles
-- Data Migration: None (new tables only)
--
-- Rollback:
--   DROP TABLE IF EXISTS "recommendation_list_items";
--   DROP TABLE IF EXISTS "recommendation_lists";
--   DROP TYPE IF EXISTS "recommendation_list_visibility";
--
-- Notes on the FK choices, because they are the load-bearing decisions here:
--
--   recommendation_lists.owner_user_id -> users.id ON DELETE CASCADE
--     Keyed to the person, not to a profile, matching profile_signals: a list
--     is a recommendation with a frame around it, so switching hats must not
--     re-attribute it, and a business must not be able to vouch for anyone.
--     NOTE: the cascade is a backstop only. An anonymized account KEEPS its
--     users row, so lib/server/delete-account.ts deletes these rows explicitly
--     — exactly as it already does for profile_signals.
--
--   recommendation_list_items.list_id -> recommendation_lists.id ON DELETE CASCADE
--     Deleting a list deletes its entries. Unremarkable.
--
--   recommendation_list_items.profile_id -> profiles.id ON DELETE SET NULL
--     The interesting one. CASCADE would let a business deleting its listing
--     silently rewrite a stranger's list — the second stop on "Cafecito crawl"
--     vanishes and the author's numbered narrative now says something they did
--     not write. RESTRICT fails the other way: a business could never leave,
--     because an unrelated account recommended it. So the pointer is nulled and
--     the row survives with its note, its position, and a name snapshot, and
--     renders as an honest tombstone. The author's words are what we protect.
-- =============================================================================

CREATE TYPE "recommendation_list_visibility" AS ENUM ('private', 'unlisted', 'public');
--> statement-breakpoint

CREATE TABLE "recommendation_lists" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "owner_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "blurb" text,
  -- Appears in the ActivityPub id URI, which remote servers store forever.
  -- Assigned once from the first title and never rewritten, the same rule
  -- actor usernames follow.
  "slug" text NOT NULL,
  "visibility" "recommendation_list_visibility" DEFAULT 'private' NOT NULL,
  "uri" text UNIQUE,
  "item_count" integer DEFAULT 0 NOT NULL,
  "published_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX "recommendation_lists_owner_visibility_idx"
  ON "recommendation_lists" ("owner_user_id", "visibility");
--> statement-breakpoint

CREATE UNIQUE INDEX "recommendation_lists_owner_slug_unique"
  ON "recommendation_lists" ("owner_user_id", "slug");
--> statement-breakpoint

CREATE TABLE "recommendation_list_items" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "list_id" text NOT NULL REFERENCES "recommendation_lists"("id") ON DELETE CASCADE,
  "profile_id" text REFERENCES "profiles"("id") ON DELETE SET NULL,
  "profile_name_at_add" text NOT NULL,
  "note" text NOT NULL,
  "position" integer NOT NULL
);
--> statement-breakpoint

-- The same business twice on one list is a mistake. The same business across
-- two lists is the feature working, so this is scoped to (list, profile).
-- Postgres treats NULLs as distinct, so tombstoned entries never collide with
-- each other — which is what we want: two dead entries are two dead entries.
CREATE UNIQUE INDEX "recommendation_list_items_list_profile_unique"
  ON "recommendation_list_items" ("list_id", "profile_id");
--> statement-breakpoint

CREATE INDEX "recommendation_list_items_list_position_idx"
  ON "recommendation_list_items" ("list_id", "position");
--> statement-breakpoint

CREATE INDEX "recommendation_list_items_profile_id_idx"
  ON "recommendation_list_items" ("profile_id");
