-- Migration: 0045_social_status_group
-- Purpose: Let a status belong to a group, so group updates can reach the feed.
-- Ticket: docs/GROUPS-ROADMAP.md — Phase 3
-- Reversible: Yes — DROP INDEX then DROP COLUMN. No existing row is touched,
--             because every status that exists today is a personal post and
--             NULL is exactly what that means.

-- NULL means an ordinary personal post. That is every row in the table right
-- now, which is why this column is nullable rather than defaulted: there is no
-- sentinel group to point the backfill at, and "belongs to no group" is a real
-- state we will keep writing forever, not a migration artifact.
ALTER TABLE social_statuses
  ADD COLUMN IF NOT EXISTS group_id text
  REFERENCES social_groups(id) ON DELETE CASCADE;

-- ON DELETE CASCADE, not SET NULL. A group's posts are addressed to its
-- members and authorized by membership; if the group is deleted, SET NULL
-- would strip the only marker that made them private and quietly promote
-- every one of them into a personal post on the author's public profile.

-- Partial, because the overwhelming majority of rows are and will stay NULL,
-- and a full index would carry them for no reader. published DESC matches the
-- order every group timeline reads in.
CREATE INDEX IF NOT EXISTS social_statuses_group_published_idx
  ON social_statuses (group_id, published DESC)
  WHERE group_id IS NOT NULL;
