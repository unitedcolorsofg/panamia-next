-- Migration: 0058_user_locks
-- Purpose: Give account locking a history, so that locking an account becomes
--          an action somebody can review rather than a flag that appeared.
--
-- Ticket: N/A
-- Reversible: Yes
--
-- Purpose (continued):
--
--          ## The state this is fixing
--
--          users.locked_at has been in the schema since 0000_initial_schema
--          and is read back by two endpoints (getSessionUser, saveSessionUser)
--          as `locked`. Nothing in the product has ever written it, and --
--          more to the point -- nothing has ever *enforced* it. There is no
--          check at sign-in, none in session enrichment, none in middleware.
--
--          So the column was a concept of a locked account with no way to
--          lock one, and had the admin console simply started writing it the
--          result would have been worse than before: a button that reports
--          "Locked" while the person carries on browsing on the session they
--          already hold. A safety control that lies is harder to fix than a
--          missing one, because nobody goes looking for it until it matters.
--
--          This migration ships alongside the enforcement (auth.ts refuses a
--          session for a locked user) and the revocation (locking deletes the
--          account's live sessions). The column alone is still not the answer.
--
--          ## Why a table and not two more columns on users
--
--          locked_at answers "is this account locked right now". It cannot
--          answer "who locked it, when, and what for", and an unlock erases
--          it entirely -- so a member who has been locked three times is
--          indistinguishable from one who never has. That is exactly the
--          history the next person needs in order to judge the fourth report.
--
--          Keeping the state on users and the history here means the hot
--          question ("can this person sign in") stays a column read on a row
--          already being fetched, while the slow question ("what happened to
--          this account") is a join nobody pays for until they ask it.
--
--          ## Why the reason is NOT NULL
--
--          A lock with no reason cannot be reviewed, appealed, or undone by
--          anybody except the person who applied it -- and only while they
--          still remember. Requiring it at the database makes "I'll write it
--          up later" impossible rather than merely discouraged. The UI
--          enforces a minimum length for the same reason; "abuse" is a
--          category, not an account of what happened.
--
--          ## Why actor_email is stored next to actor_user_id
--
--          Two reasons, and both are about the log outliving the people in it.
--
--          ADMIN_EMAILS -- the founder tier -- may name an address that has
--          no account behind it at all. That is deliberate: it is the
--          recovery path, and it works precisely because it does not depend
--          on a database row. Such an actor has no user id to record.
--
--          And an actor who does have an account may later delete it. The FK
--          is ON DELETE SET NULL so that deletion is not blocked by this log,
--          which would otherwise turn an audit trail into a reason somebody
--          cannot leave. Keeping the email means the row still says who acted
--          after the id is gone.
--
-- Dependencies: users.
--
-- Data Migration: None. locked_at is set on nobody in production -- nothing
--                 has ever written it -- so there is no prior lock to record
--                 and a backfill would be inventing history. Any row that
--                 somehow does carry locked_at keeps it; it simply has no
--                 entry here, which reads correctly as "locked before this
--                 log existed".
--
-- Rollback:
--   DROP TABLE IF EXISTS "user_locks";
-- =============================================================================

CREATE TABLE IF NOT EXISTS "user_locks" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  -- What happened, not what is true now. Two rows for one account is the
  -- normal case: locked on Tuesday, unlocked on Friday.
  "action" text NOT NULL,
  -- Required. See the header.
  "reason" text NOT NULL,
  -- Null when the actor was an ADMIN_EMAILS address with no account, or when
  -- that account has since been deleted. actor_email always says who.
  "actor_user_id" text,
  "actor_email" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "user_locks_action_check"
    CHECK ("action" IN ('lock', 'unlock')),
  -- Guards the "I'll write it up later" empty string, which a NOT NULL alone
  -- would happily accept.
  CONSTRAINT "user_locks_reason_not_blank"
    CHECK (length(btrim("reason")) > 0),

  CONSTRAINT "user_locks_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_locks_actor_user_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

-- The only read this table has: "show me this account's lock history, newest
-- first". Composite rather than two indexes because the sort is always within
-- a single user.
CREATE INDEX IF NOT EXISTS "user_locks_user_id_created_at_idx"
  ON "user_locks" ("user_id", "created_at" DESC);
