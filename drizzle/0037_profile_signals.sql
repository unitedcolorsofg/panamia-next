-- Migration: 0037_profile_signals
-- Purpose: Give the directory the two numbers a pana actually decides on —
--          how many people saved a listing, and how many vouch for it — plus
--          the Pana Mia certification mark.
--
--          Saves and recommendations share one table because they have the
--          same shape and the same uniqueness rule, but they are not the same
--          act. A save is a private bookmark; a recommendation is a public
--          statement about a business. The kind enum keeps them separable so
--          the read layer can expose recommenders by name while savers stay
--          anonymous.
--
--          Rows are keyed to users.id rather than profiles.id on purpose. A
--          save belongs to the person who made it, not to whichever profile
--          they happened to be acting as at the time; keying it to a profile
--          would move someone's saved list every time they switched hats, and
--          would let a business appear to recommend its competitors. It also
--          makes the product rule enforceable in one place: only a human
--          acting as themselves can write here.
--
--          pana_certified_at is a timestamp rather than a boolean because the
--          useful questions are "certified since when?" and "which ones were
--          granted before the policy changed" — a boolean answers neither.
--          NULL means not certified. Staff-set only.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: profiles, users. 0035_profile_owners.
-- Data Migration: None. Both additions start empty/NULL, which is the correct
--                 initial state — no listing is certified until staff say so,
--                 and no save exists until a pana makes one.
--
-- Rollback:
--   DROP TABLE IF EXISTS "profile_signals";
--   DROP TYPE IF EXISTS "profile_signal_kind";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "pana_certified_at";
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE "profile_signal_kind" AS ENUM ('save', 'recommend');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "profile_signals" (
  "id" text PRIMARY KEY,
  "profile_id" text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" "profile_signal_kind" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- One save and one recommendation per person per listing. This is also what
-- makes the toggle endpoints idempotent, so a double-tap on a slow connection
-- cannot inflate a business's numbers.
CREATE UNIQUE INDEX IF NOT EXISTS "profile_signals_profile_user_kind"
  ON "profile_signals" ("profile_id", "user_id", "kind");
--> statement-breakpoint

-- "How many panas saved this?" — the counts rendered on every profile page.
CREATE INDEX IF NOT EXISTS "profile_signals_profile_kind_idx"
  ON "profile_signals" ("profile_id", "kind");
--> statement-breakpoint

-- "What have I saved?" — the member's own saved-listings view.
CREATE INDEX IF NOT EXISTS "profile_signals_user_kind_idx"
  ON "profile_signals" ("user_id", "kind");
--> statement-breakpoint

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "pana_certified_at" timestamp with time zone;
--> statement-breakpoint

-- Partial index: certified listings are a small minority and the only query
-- that matters is "show me the certified ones", so indexing the NULLs would
-- be dead weight.
CREATE INDEX IF NOT EXISTS "profiles_pana_certified_idx"
  ON "profiles" ("pana_certified_at")
  WHERE "pana_certified_at" IS NOT NULL;
