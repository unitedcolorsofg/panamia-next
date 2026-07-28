-- Migration: 0030_contact_submissions_status_category
-- Purpose: Rebuild the Contact Us admin queue on the same moderation model as
--          relay_reports (see /account/admin/reports). Two changes:
--          1. Replace the `acknowledged` boolean with a three-state status
--             enum (open / actioned / dismissed) plus a moderation reason and
--             an action timestamp, so an operator can dismiss spam without it
--             looking identical to a handled request.
--          2. Add a `category` enum set on the public form, so submissions can
--             be triaged and filtered by what they're about.
--          3. Record who sent it when the sender was signed in (`user_id` plus
--             a `screenname` snapshot), so an operator can tie a submission to
--             an account instead of guessing from a self-typed name/email.
-- Ticket: N/A
-- Reversible: Partial -- the acknowledged boolean can be reconstructed from
--             status, but the open/dismissed distinction and every category
--             value are lost on rollback.
--
-- Dependencies: 0000_initial_schema (contact_submissions exists)
-- Data Migration: Inline. acknowledged=true -> 'actioned', false -> 'open';
--                 every existing row gets category 'general'.
--
-- Rollback:
--   ALTER TABLE "contact_submissions" ADD COLUMN "acknowledged" boolean NOT NULL DEFAULT false;
--   UPDATE "contact_submissions" SET "acknowledged" = ("status" = 'actioned');
--   DROP INDEX IF EXISTS "contact_submissions_status_idx";
--   DROP INDEX IF EXISTS "contact_submissions_category_idx";
--   DROP INDEX IF EXISTS "contact_submissions_user_id_idx";
--   ALTER TABLE "contact_submissions"
--     DROP COLUMN "status",
--     DROP COLUMN "category",
--     DROP COLUMN "moderation_reason",
--     DROP COLUMN "last_moderation_action_at",
--     DROP COLUMN "user_id",
--     DROP COLUMN "screenname";
--   DROP TYPE IF EXISTS "contact_submission_status";
--   DROP TYPE IF EXISTS "contact_submission_category";
-- =============================================================================

-- Enum member order matters: Postgres sorts enum columns by DECLARED order, so
-- `ORDER BY status ASC` floats unhandled submissions to the top of the queue.
DO $$ BEGIN
  CREATE TYPE "contact_submission_status" AS ENUM ('open', 'actioned', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "contact_submission_category" AS ENUM ('general', 'membership', 'press', 'technical', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "contact_submissions"
  ADD COLUMN IF NOT EXISTS "status" "contact_submission_status" NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS "category" "contact_submission_category" NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS "moderation_reason" text,
  ADD COLUMN IF NOT EXISTS "last_moderation_action_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "user_id" text,
  ADD COLUMN IF NOT EXISTS "screenname" text;

-- The account that submitted the form, when it was submitted while signed in.
-- SET NULL rather than CASCADE: a deleted account shouldn't silently take the
-- support history with it. (`screenname` is a snapshot taken at submit time and
-- deliberately survives both account deletion and later screenname changes, so
-- the admin queue still shows who the thread was with.)
DO $$ BEGIN
  ALTER TABLE "contact_submissions"
    ADD CONSTRAINT "contact_submissions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Carry the old boolean over before it goes away. Acknowledged submissions were
-- ones an operator had dealt with, which is what 'actioned' means now.
UPDATE "contact_submissions"
  SET "status" = 'actioned',
      "last_moderation_action_at" = "updated_at"
  WHERE "acknowledged" = true;

ALTER TABLE "contact_submissions" DROP COLUMN IF EXISTS "acknowledged";

CREATE INDEX IF NOT EXISTS "contact_submissions_status_idx"
  ON "contact_submissions" ("status");

CREATE INDEX IF NOT EXISTS "contact_submissions_category_idx"
  ON "contact_submissions" ("category");

CREATE INDEX IF NOT EXISTS "contact_submissions_user_id_idx"
  ON "contact_submissions" ("user_id");
