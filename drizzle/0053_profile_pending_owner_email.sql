-- Migration: 0053_profile_pending_owner_email
-- Purpose: Let a business intake submission name the personal inbox that
--          should end up running the listing, before any account exists.
--
--          /form/list-your-business is deliberately unauthenticated: most
--          South Florida businesses hear about Pana from another Pana, and
--          making them create an account before they can tell us they exist
--          loses them. That stays true. But the submitter is very often the
--          owner, and today they finish the form with no thread back to an
--          account at all — they wait for review, then wait for a claim email
--          sent to the *business* inbox, which on a shared shop address may be
--          read by nobody in particular.
--
--          This column holds the optional second address they gave, so the
--          intent survives until there is an account to attach it to. Once
--          that person signs in, the listing is *offered* to them, and a
--          profile_owners row is written only if they say it is theirs. The
--          column is cleared either way.
--
--          It is an offer rather than an automatic grant because this value
--          arrives from a public, unauthenticated form and is therefore
--          attacker-controlled: anyone can submit a listing naming someone
--          else's address. Redeeming that silently would hand a stranger's
--          business to whoever happened to be named. See
--          lib/server/pending-listing-owner.ts for the full reasoning.
--
--          Why a column rather than a key inside profiles.status, which
--          already carries the rest of the intake record:
--
--            - It is queried BY VALUE ("which listings are waiting for this
--              address?") every time the account menu loads. That is a
--              reverse lookup and wants a btree index. Nothing searches
--              status by content; status is only ever read by profile id.
--            - It is cleared on answer. That is one SET here. Inside the
--              JSONB it would be a read-modify-write, racing the admin
--              approve/decline path (app/api/admin/profile/action), which
--              rewrites status wholesale and would silently resurrect an
--              address that had already been answered.
--
--          Deliberately NOT unique. Two unrelated submissions may name the
--          same personal address — a pana listing two shops they run, or
--          helping a friend — and rejecting the second would lose a listing
--          to protect nothing. Each offer is answered independently.
--
--          Holding a value here proves nothing on its own. It records a
--          request. Control of the inbox is proven by the magic link and by
--          the explicit answer, and whether the business is actually theirs
--          is covered by the existing admin review gate, which this does not
--          touch: listings still land active = false and still need approval
--          to publish.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: profiles.
-- Data Migration: None. NULL is correct for every existing row — they predate
--                 the field and no pending intent can be inferred for them.
--                 An existing listing is still claimed the explicit way, via
--                 lib/server/listing-claim.ts.
--
-- Rollback:
--   DROP INDEX IF EXISTS "profiles_pending_owner_email_idx";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "pending_owner_email";
-- =============================================================================

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "pending_owner_email" text;

COMMENT ON COLUMN "profiles"."pending_owner_email" IS
  'Optional personal address given at intake. The listing is offered to that account when it signs in, and a profile_owners row is written only on an explicit yes. Cleared once answered. Records a request, not a proof of ownership.';

-- Partial: the column is NULL on virtually every row (only listings awaiting
-- an answer carry one), so indexing the nulls would be most of the index for
-- none of the lookups. Every lookup is an equality on the address, which
-- implies IS NOT NULL, so the planner can still use it.
CREATE INDEX IF NOT EXISTS "profiles_pending_owner_email_idx"
  ON "profiles" ("pending_owner_email")
  WHERE "pending_owner_email" IS NOT NULL;
