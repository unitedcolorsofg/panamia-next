-- Migration: 0055_profile_connector
-- Purpose: Give the Connectors programme somewhere real to store membership,
--          so /connectors/hq can greet the person actually signed in.
--
--          The Connectors surface shipped as a fixture mock: every connector,
--          house and commitment on it was invented, and the dashboard greeted
--          a hardcoded demo person regardless of who was logged in. A signed-in
--          member looking at their own HQ was told "Hey, Bianca." That is the
--          whole reason this column exists.
--
--          Membership is four facts, all chosen by the member at intake:
--          which pod they can physically get to, which houses they want to
--          work in, what they can bring, and when they joined. Tier is stored
--          but is always 1 on join — the programme is explicit that tiers
--          describe how much somebody is carrying and do not rank anybody, so
--          there is nothing to ask and nothing to award at signup.
--
--          Why a JSONB column on profiles rather than connector tables:
--
--            - It is only ever read BY PROFILE. "What is my membership?" is
--              the single access pattern, and it arrives with the profile row
--              the page already loads. Nothing searches membership by content
--              except a pod headcount, which is a count over a cheap
--              expression index, added below.
--            - It is written whole. Join writes the blob once; later edits
--              replace it. There is no field that is updated independently of
--              the others, so the read-modify-write that makes JSONB a bad
--              choice for profiles.pending_owner_email (see 0053) does not
--              apply — there is no second writer racing it.
--            - profiles already carries 39 of these. mentoring, gentedepana,
--              availability and verification are all exactly this shape:
--              optional per-feature membership blobs on the identity row. A
--              new table here would be the odd one out, not the safe choice.
--
--          The thing this deliberately does NOT model is programme-wide
--          content — events, open asks, birthdays. Those belong to whoever
--          runs the programme, are created from the admin console, and that
--          console now lives on admin.pana.social and is out of scope. Until
--          they have a real home they are simply not shown to members, rather
--          than shown as fiction.
--
--          Membership is self-serve on purpose. There is no pending/approved
--          state because there is no approval step to model: the programme
--          recruits by asking people to show up, everyone starts at Tier 1,
--          and gatekeeping the first rung would contradict the tiers. If an
--          approval gate is wanted later it is an added key, not a migration.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: profiles.
-- Data Migration: None. NULL is correct for every existing row: nobody has
--                 joined through a form that did not exist until now, and no
--                 membership can be inferred for anyone. The fixture roster
--                 that previously backed this surface was invented and is not
--                 backfilled — importing fabricated people as real members is
--                 exactly the bug this migration closes.
--
-- Rollback:
--   DROP INDEX IF EXISTS "profiles_connector_pod_idx";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "connector";
-- =============================================================================

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "connector" jsonb;

COMMENT ON COLUMN "profiles"."connector" IS
  'Connectors programme membership for the human behind this profile: pod, houses, tier, what they can bring, joined-at, and their own commitments. NULL means not a connector. Written by /api/connectors/join, read by /connectors/hq. Programme-wide content (events, asks) is deliberately not modelled here.';

-- Partial expression index over the pod. The column is NULL on virtually
-- every row — most profiles are not connectors, and many are business
-- listings that never will be — so indexing the nulls would be most of the
-- index for none of the lookups.
--
-- The one content lookup is the pod headcount shown on HQ ("Miami · N
-- connectors"), which is an equality on this expression and therefore implies
-- IS NOT NULL, so the planner can still use it. Everything else reaches
-- membership by profile id and does not touch this index at all.
CREATE INDEX IF NOT EXISTS "profiles_connector_pod_idx"
  ON "profiles" (("connector" ->> 'pod'))
  WHERE "connector" IS NOT NULL;
