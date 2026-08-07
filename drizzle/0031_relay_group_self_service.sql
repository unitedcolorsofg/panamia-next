-- Migration: 0031_relay_group_self_service
-- Purpose: Let members create and run their own NIP-29 groups from /r/groups
--          instead of every group being provisioned by hand. Three changes:
--          1. `relay_groups.created_by` records which member made the group.
--             It holds a hex pubkey, NOT a profile/user id, so it lives in the
--             same identity space as relay_group_members and survives the
--             pubkey-keyed cleanup in lib/server/delete-account.ts. NULL means
--             "provisioned by panamia" (panamia-test, panamia-public) and is
--             the flag that exempts a group from delete-when-empty.
--          2. `relay_groups.join_policy` splits member-made groups into
--             invite-only and open-to-all-panas. `discoverable` is derived
--             from it at write time (open => discoverable), so the browse page
--             and the relay's public kind-39000 emission never disagree about
--             which groups exist.
--          3. `relay_group_invites` holds outstanding invitations. Keyed by
--             users.id rather than pubkey because an invite is delivered to a
--             Pana account through the notifications table / inbox, and the
--             invitee may not have enrolled a Nostr key yet at the moment
--             they are invited.
--          Also extends the notification enums so an invite can be rendered
--          by lib/notifications.ts.
-- Ticket: N/A
-- Reversible: Partial -- dropping join_policy loses the invite-only/open
--             distinction, and the enum values added to notification_context
--             and notification_object_type cannot be removed from a Postgres
--             enum without recreating the type.
--
-- Dependencies: 0023_nostr_schema (relay_groups, relay_group_members)
-- Data Migration: None. Existing rows keep created_by NULL, which correctly
--                 marks the two hand-provisioned groups as system-owned.
--
-- Rollback:
--   DROP TABLE IF EXISTS "relay_group_invites";
--   DROP INDEX IF EXISTS "relay_groups_created_by_idx";
--   ALTER TABLE "relay_groups"
--     DROP COLUMN "created_by",
--     DROP COLUMN "join_policy";
--   DROP TYPE IF EXISTS "relay_group_join_policy";
--   -- notification_context / notification_object_type keep the 'group' value.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE "relay_group_join_policy" AS ENUM ('invite_only', 'open');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Hex pubkey of the member who currently holds creator rights (metadata edits
-- and invites). Reassigned to the longest-tenured remaining member when the
-- holder leaves -- see reassignCreatorIfNeeded in lib/relay/group-lifecycle.ts.
-- Deliberately NOT a foreign key: relay_group_members.pubkey has no FK to
-- profiles either, and a group must keep working if the creator's profile row
-- is deleted out from under it.
ALTER TABLE "relay_groups"
  ADD COLUMN IF NOT EXISTS "created_by" text,
  ADD COLUMN IF NOT EXISTS "join_policy" "relay_group_join_policy" NOT NULL DEFAULT 'invite_only';

CREATE INDEX IF NOT EXISTS "relay_groups_created_by_idx"
  ON "relay_groups" ("created_by");

-- Outstanding invitations. Deleting the group takes its invites with it;
-- deleting either account does the same, since an invite is meaningless
-- without both ends. The (group_id, invited_user_id) unique index makes
-- re-inviting the same person a no-op rather than a pile of duplicates.
CREATE TABLE IF NOT EXISTS "relay_group_invites" (
  "id" text PRIMARY KEY,
  "group_id" text NOT NULL REFERENCES "relay_groups"("group_id") ON DELETE CASCADE,
  "invited_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invited_by_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "relay_group_invites_pk"
  ON "relay_group_invites" ("group_id", "invited_user_id");

CREATE INDEX IF NOT EXISTS "relay_group_invites_invited_user_id_idx"
  ON "relay_group_invites" ("invited_user_id");

CREATE INDEX IF NOT EXISTS "relay_group_invites_expires_at_idx"
  ON "relay_group_invites" ("expires_at");

-- Notification plumbing for group invites. ADD VALUE IF NOT EXISTS is
-- idempotent and, unlike the CREATE TYPE blocks above, cannot run inside a
-- transaction block on PG < 12 -- Supabase is well past that.
ALTER TYPE "notification_context" ADD VALUE IF NOT EXISTS 'group';
ALTER TYPE "notification_object_type" ADD VALUE IF NOT EXISTS 'group';
