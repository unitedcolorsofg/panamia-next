-- Migration: 0042_backfill_actor_icon_from_profile
-- Purpose: Copy each local profile's current picture onto its social actor, so
--          members who set or changed a picture after enrolling stop showing
--          as initials everywhere on Pana Social.
-- Ticket: N/A
-- Reversible: No - the previous icon_url values are overwritten in place and
--             are not copied anywhere first. They were stale or absent by
--             definition, so there is nothing worth restoring.
--
-- Copy each local profile's picture onto its social actor.
--
-- Pana Social does not read the profile when it renders an avatar. It reads
-- social_actors.icon_url, a copy kept alongside the actor because federation
-- serves it to other servers from there.
--
-- That copy was only ever written when the actor was first created.
-- syncActorFromProfile() was written to keep it current and had no callers
-- anywhere in the codebase, so a picture set or changed after enrolling
-- reached the profile and stopped. The account chrome reads the profile
-- directly, which is why the same person could see their new picture in the
-- corner of the page and initials in the composer directly below it.
--
-- The upload endpoint now calls that sync, so this is only about the accounts
-- already in that state -- they would otherwise have to re-upload a picture
-- they had already set, to fix something they could not see the cause of.
--
-- The profile is the authoritative copy: nothing in the app sets an actor
-- icon independently of it, so there is no member choice being overwritten
-- here. Remote actors federated from other servers carry no profile_id, so
-- the join leaves their icons alone. Profiles with no picture are skipped
-- rather than blanking an icon, and IS DISTINCT FROM makes re-running a
-- no-op.

UPDATE social_actors sa
SET icon_url = p.primary_image_cdn
FROM profiles p
WHERE sa.profile_id = p.id
  AND p.primary_image_cdn IS NOT NULL
  AND sa.icon_url IS DISTINCT FROM p.primary_image_cdn;
