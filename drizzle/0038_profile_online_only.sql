-- Migration: 0038_profile_online_only
-- Purpose: Let a listing say it has no storefront to visit.
--
--          The directory answers "what is near me", so a business profile
--          shows how far away it is. That question is meaningless for a
--          business that operates online — a virtual bakery, a remote
--          consultancy — and worse than meaningless when it has an address on
--          file, because the address is usually the owner's home or a
--          registered agent. Measuring distance to it invites panas to show up
--          somewhere nobody works, and quietly publishes where the owner
--          lives.
--
--          A dedicated flag rather than inferring it from a missing address.
--          Absent coordinates already mean something else and occur for
--          ordinary reasons: a storefront that has not finished onboarding, or
--          one whose address failed to geocode. Those listings should still
--          read as physical and should start showing a distance the moment
--          their address lands. Conflating the two would make "we have a shop,
--          we just have not typed it in yet" indistinguishable from "there is
--          nowhere to go", and would silently flip a business's public
--          description as a side effect of an unrelated edit.
--
--          Events already model this distinction separately (an event is
--          online or has a venue). This is the same fact about the business
--          itself, and the two are independent: an online-only business can
--          still host an in-person pop-up.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: profiles.
-- Data Migration: None. NOT NULL DEFAULT false is the correct initial state —
--                 every existing listing predates the concept and is treated
--                 as physical, which is the status quo behaviour. Owners opt
--                 in; nothing infers this from address data.
--
-- Rollback:
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "online_only";
-- =============================================================================

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "online_only" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "profiles"."online_only" IS
  'This business has no location to visit. Suppresses distance and directions on the public profile. Set by the owner; never inferred from a missing address.';
