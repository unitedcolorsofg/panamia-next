-- Migration: 0054_clear_status_locations
-- Purpose: Erase coordinates left behind by the removed voice-memo geotag
--          feature. Voice memos are direct messages, so these rows record
--          where a member was standing when they recorded a private message
--          to one person. The composer that collected them is gone; keeping
--          the data would mean retaining the most sensitive thing a post can
--          hold for a feature that no longer exists.
-- Ticket: N/A (App Store submission prep, privacy)
-- Reversible: No
--
-- Dependencies: social_statuses (0030_social_core.sql)
-- Data Migration: Inline
--
-- Rollback:
--   None. The coordinates are deleted, not archived, which is the point of
--   the migration. Restoring them means restoring from a database backup
--   taken before this ran.
--
-- =============================================================================

-- Only rows that actually carry a location are touched, so the write set is
-- the handful of geotagged posts rather than every status ever created. The
-- column stays on the table: PostCard still reads it, and a NOT NULL-free
-- JSONB column costs nothing to keep.
--
-- Note this is local erasure only. Any geotagged post that federated out
-- carried its Place object to the remote server, and nothing here reaches
-- those copies -- there is no ActivityPub mechanism to retract one field of
-- an already-delivered object. Deleting ours is still worth doing: it is the
-- copy we control, the one that serves our own members and API, and the one
-- that would otherwise keep re-federating on every future fetch.
UPDATE "social_statuses"
SET "location" = NULL
WHERE "location" IS NOT NULL;
