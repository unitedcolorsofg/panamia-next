-- =============================================================================
-- Migration: 0051_social_dm_requests
-- Purpose: Gate who may open a direct-message thread, and give a recipient
--          somewhere to answer from. Until now createStatus validated exactly
--          three things for visibility 'direct' — at least one recipient, no
--          more than eight, and that the rows exist — and checked no
--          relationship whatsoever between sender and recipient. Any account
--          could message eight panas at once, unsolicited, and the route then
--          wrote a notification for each. Blocking was no help: the first
--          message is the harm and blocking only exists afterwards.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: social_actors
-- Data Migration: None. The new column defaults to 'everyone', which is the
--                 behaviour every existing account already has, so no row
--                 changes meaning when this lands.
--
-- Rollback:
--   DROP TABLE IF EXISTS "social_dm_requests";
--   ALTER TABLE "social_actors" DROP COLUMN IF EXISTS "dm_policy";
--   DROP TYPE IF EXISTS "social_dm_request_state";
--   DROP TYPE IF EXISTS "social_dm_policy";
--
-- The default is 'everyone' rather than 'panas', and that reverses an earlier
-- draft of docs/SOCIAL-GRAPH.md section C1. The scarce resource in a network
-- this size is not conversation volume, it is first contacts that happen at
-- all — a pana finds a maker or a business in the directory and writes to
-- them. Defaulting to mutual-follows-only blocks precisely that person, and a
-- mutual follow is a weak stand-in for consent anyway: it is a thinner claim
-- than "I read your profile and want to work with you".
--
-- What replaces it is the Requests folder, and the load-bearing part is not
-- that the message is filed separately — it is that it RINGS NOBODY'S PHONE.
-- The harm this migration exists to stop was never "a stranger wrote to me",
-- it was "a stranger can make my phone buzz eight times". The recipient
-- reviews on their own schedule.
--
-- Why a consent table and not a threads table. The gate belongs on thread
-- creation rather than on every message, or replying inside a thread the
-- recipient already accepted would break — an existing thread is itself the
-- consent. But there is no threads table to ask, and deriving the answer from
-- social_statuses would mean scanning direct statuses in both directions while
-- still being unable to express accepted-but-not-yet-replied-to or
-- deleted-without-replying. It would also rot: direct statuses expire
-- (DM_EXPIRY_DAYS), so consent inferred from messages would silently lapse and
-- re-prompt a correspondent you had already accepted. Threading itself is a
-- property of the mail UI and can be derived from in_reply_to_id later.
--
-- Two states, not three. 'declined' is deliberately absent. The Requests UI
-- offers delete-without-replying and block as separate actions and they mean
-- different things: deleting is "not now" and must leave the sender able to
-- try again, while block is the permanent answer and social_blocks already
-- enforces it. A 'declined' state would be a third, invisible block with no
-- settings screen to undo it from.
--
-- UNIQUE (recipient_actor_id, sender_actor_id) is directional on purpose. The
-- mirrored pair is a separate row: accepting someone's request is not the same
-- as them accepting yours, and collapsing the two would let one person's
-- acceptance open a thread the other never agreed to.
--
-- Both directions are indexed because both are read. recipient_actor_id
-- answers "show me my requests"; sender_actor_id answers "may this sender
-- write to me", which runs on every direct send.
--
-- dm_policy is local-only and is NOT published on the actor document.
-- ActivityPub has no equivalent field, so a remote actor's value is always the
-- default and is never read — we cannot know a remote server's policy and must
-- not invent one. It is also kept out of PUBLIC_ACTOR_COLUMNS because
-- publishing it makes blocks inferable: a blocked sender would see a policy of
-- 'everyone', be refused anyway, and have their answer.
-- =============================================================================

CREATE TYPE "social_dm_policy" AS ENUM ('everyone', 'panas', 'nobody');
--> statement-breakpoint

CREATE TYPE "social_dm_request_state" AS ENUM ('pending', 'accepted');
--> statement-breakpoint

ALTER TABLE "social_actors"
  ADD COLUMN "dm_policy" "social_dm_policy" DEFAULT 'everyone' NOT NULL;
--> statement-breakpoint

CREATE TABLE "social_dm_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "recipient_actor_id" text NOT NULL REFERENCES "social_actors"("id") ON DELETE CASCADE,
  "sender_actor_id" text NOT NULL REFERENCES "social_actors"("id") ON DELETE CASCADE,
  "state" "social_dm_request_state" DEFAULT 'pending' NOT NULL,
  "accepted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE UNIQUE INDEX "social_dm_requests_recipient_sender_unique"
  ON "social_dm_requests" ("recipient_actor_id", "sender_actor_id");
--> statement-breakpoint

CREATE INDEX "social_dm_requests_recipient_actor_id_idx"
  ON "social_dm_requests" ("recipient_actor_id");
--> statement-breakpoint

CREATE INDEX "social_dm_requests_sender_actor_id_idx"
  ON "social_dm_requests" ("sender_actor_id");
