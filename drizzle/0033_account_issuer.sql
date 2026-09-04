-- Migration: 0033_account_issuer
-- Purpose: better-auth 1.7 re-keys accounts by (issuer, account_id) instead of
--          (provider_id, account_id). provider_id still names the configured
--          connection; issuer names the identity namespace that authenticated
--          the subject — a real protocol issuer for OIDC providers
--          ("https://accounts.google.com") or a synthetic
--          "local:oauth:<providerId>" for providers that declare none.
--
--          better-auth's own tooling refuses to add this column to a populated
--          table (it is required with no default), so the add / backfill /
--          NOT NULL / unique-index sequence is spelled out here. The backfill
--          values mirror lib/auth-issuer.ts, which is what application code
--          writing account rows outside the OAuth callback path uses.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: accounts table (better-auth migration), 0016_drop_duplicate_unique_indexes
-- Data Migration: Inline. Idempotent — re-running backfills nothing.
--
-- Rollback:
--   DROP INDEX IF EXISTS "accounts_issuer_account_unique";
--   ALTER TABLE "accounts" DROP COLUMN IF EXISTS "issuer";
-- =============================================================================

-- 1. Add nullable so existing rows survive the statement.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "issuer" text;
--> statement-breakpoint

-- 2. Backfill. google/apple carry better-auth's declared accountIssuer;
--    everything else (wikimedia, mastodon — configured without a discoveryUrl,
--    so better-auth has no discovered issuer for them) gets the synthetic
--    namespace. Provider ids here are all URL-safe, so the concatenation
--    matches encodeURIComponent(providerId).
UPDATE "accounts"
SET "issuer" = CASE "provider_id"
  WHEN 'google' THEN 'https://accounts.google.com'
  WHEN 'apple' THEN 'https://appleid.apple.com'
  WHEN 'credential' THEN 'local:credential'
  ELSE 'local:oauth:' || "provider_id"
END
WHERE "issuer" IS NULL;
--> statement-breakpoint

-- 3. Now that every row has a value, make it required.
ALTER TABLE "accounts" ALTER COLUMN "issuer" SET NOT NULL;
--> statement-breakpoint

-- 4. The identity better-auth 1.7 looks accounts up by. The older
--    accounts_provider_account_unique stays: provider_id -> issuer is 1:1 in
--    this configuration, so it is a redundant but harmless second guard.
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_issuer_account_unique"
  ON "accounts" ("issuer", "account_id");
