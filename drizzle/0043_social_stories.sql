-- Migration: 0043_social_stories
-- Purpose: Back "stories" -- a pana's recent photos/clips, reached by tapping
--          their profile picture and gone 24 hours later.
--
--          Deliberately NOT a new status table. A story is a row in
--          social_statuses with type = 'Story' and expires_at set, because the
--          two hard parts were already built and tested there: `expires_at` is
--          honoured by the notExpired() guard every timeline read already
--          applies (DMs have used it since 0000), and social_attachments
--          already carries the image/video R2 URLs. A parallel table would
--          have had to re-earn both, and would have forked media handling.
--
--          What that reuse costs is one obligation, paid in
--          lib/federation/wrappers/timeline.ts: every read path that should
--          show posts must now say `type <> 'Story'`. getActorPosts() is the
--          sharp edge -- unlike the home/public timelines it has no
--          public-recipient filter, so without the exclusion a story would
--          appear as a normal post on the profile's Posts tab the moment it
--          was created.
--
--          Stories are also addressed followers-only (recipient_to =
--          [followers], recipient_cc = []) rather than Public. That is defence
--          in depth, not a visibility rule -- the stories endpoint serves them
--          to anyone who opens the profile. Keeping the Public URI out of the
--          recipients means the ActivityPub outbox, which selects on
--          `recipient_to @> [Public]`, cannot federate a story even if a future
--          read path forgets the type filter. Mastodon has no story concept, so
--          a federated one would land as a post that never disappears.
--
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: 0000_initial_schema (social_statuses, social_actors)
-- Data Migration: None. No existing row has type = 'Story'.
--
-- Rollback:
--   DROP TABLE IF EXISTS "social_story_views";
--   DROP INDEX IF EXISTS "social_statuses_active_story_idx";
--
-- =============================================================================

-- Serves the only hot read stories add: "active stories for this actor, oldest
-- first". Partial on type so it stays small -- stories are a rounding error
-- next to notes, and expire out of relevance within a day -- and it keeps the
-- ordering column so the viewer's playback order comes from the index.
--
-- expires_at is intentionally NOT in the predicate: NOW() is not IMMUTABLE, so
-- Postgres will not accept it in a partial index. Expiry stays a runtime
-- filter; this index narrows to the right actor's stories first, which is the
-- part that matters.
CREATE INDEX IF NOT EXISTS "social_statuses_active_story_idx"
  ON "social_statuses" ("actor_id", "published")
  WHERE "type" = 'Story';

-- Who has seen which story. Drives the "new stories" ring on the avatar and the
-- owner's view count.
--
-- Rows are only written for signed-in viewers with a social actor. An anonymous
-- visitor reading a story is not recorded -- there is no stable identity to
-- attribute it to, and inventing one (IP, fingerprint) to power a decoration
-- would be a tracking mechanism the privacy policy does not cover.
CREATE TABLE IF NOT EXISTS "social_story_views" (
  "id" text PRIMARY KEY,
  "status_id" text NOT NULL
    REFERENCES "social_statuses" ("id") ON DELETE CASCADE,
  "viewer_actor_id" text NOT NULL
    REFERENCES "social_actors" ("id") ON DELETE CASCADE,
  "viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- One row per (story, viewer). The write path is an idempotent upsert that
-- relies on this constraint, so a viewer replaying a story does not inflate the
-- owner's count.
CREATE UNIQUE INDEX IF NOT EXISTS "social_story_views_status_viewer_unique"
  ON "social_story_views" ("status_id", "viewer_actor_id");

-- "Which of these stories have I already seen", asked once per profile open.
CREATE INDEX IF NOT EXISTS "social_story_views_viewer_idx"
  ON "social_story_views" ("viewer_actor_id");
