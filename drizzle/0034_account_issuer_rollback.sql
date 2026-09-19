-- Migration: 0034_account_issuer_rollback
-- Purpose: better-auth removed the account issuer between 1.7.2 and 1.7.4. The
--          1.7.0-1.7.2 model keyed an account by (issuer, account_id) and
--          exported the helpers 0033 was built against —
--          createOAuthAccountIssuer and each social provider's accountIssuer.
--          Neither ships in 1.7.4; the account model has no issuer field at
--          all, and identity is back to (provider_id, account_id).
--
--          That leaves "issuer" as a NOT NULL column Better Auth never writes,
--          which its schema check rejects outright: every /api/auth/* request
--          fails with SCHEMA_MISMATCH before it reaches a handler, so sign-in
--          is down. Making the column nullable would clear the check but let
--          Better Auth write NULL while app code writes a real issuer, so the
--          two would stop matching and a second account row would be linked on
--          the next sign-in — the exact failure 0033 was written to prevent.
--          Dropping it restores the key both sides agree on.
--
--          Also restores accounts.password, which 0007 dropped. Better Auth
--          declares it on the account model (optional) and requires the column
--          to exist. It is added nullable and stays NULL here: emailAndPassword
--          is not configured in auth.ts, so no password hash is ever written
--          and 0007's reason for dropping it is preserved in practice.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: 0007_drop_accounts_password, 0033_account_issuer
-- Data Migration: None. Dropping issuer discards the backfill from 0033;
--                 accounts_provider_account_unique already guarantees the
--                 (provider_id, account_id) pair those values were derived
--                 from, so no identity is lost.
--
-- Rollback:
--   ALTER TABLE "accounts" DROP COLUMN IF EXISTS "password";
--   -- then re-run 0033 to re-add, backfill and index "issuer".
-- =============================================================================

-- 1. Drop the index first: it depends on the column.
DROP INDEX IF EXISTS "accounts_issuer_account_unique";--> statement-breakpoint

-- 2. accounts_provider_account_unique remains as the identity guard, matching
--    the (provider_id, account_id) key better-auth 1.7.4 looks accounts up by.
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "issuer";--> statement-breakpoint

-- 3. Nullable, never written while emailAndPassword stays unconfigured.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "password" text;
