-- Migration: 0027_compliance_records_survive_deletion
-- Purpose: Drop the ON DELETE CASCADE foreign keys on consent_receipts.user_id
--          and screenname_history.user_id. Both are now compliance_record data
--          that must OUTLIVE the account: consent receipts are proof consent
--          existed, and screenname history backs federation 410-Gone redirects.
--          The cascade FKs silently deleted them when the user row was removed
--          (a latent bug for screenname_history, which delete-account.ts already
--          intended to keep). user_id stays as a bare text column, matching
--          deletion_logs.user_id.
-- Ticket: N/A
-- Reversible: Yes -- re-add the FKs:
--   ALTER TABLE "consent_receipts" ADD CONSTRAINT
--     "consent_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id")
--     REFERENCES "users"("id") ON DELETE cascade;
--   ALTER TABLE "screenname_history" ADD CONSTRAINT
--     "screenname_history_user_id_users_id_fk" FOREIGN KEY ("user_id")
--     REFERENCES "users"("id") ON DELETE cascade;
--
-- Dependencies: 0017_add_foreign_keys_and_soft_delete (created both FKs).
-- Data Migration: None (greenfield). The columns and their values are unchanged;
--                 only the FK constraints are dropped.
-- =============================================================================

--> statement-breakpoint
ALTER TABLE "consent_receipts" DROP CONSTRAINT IF EXISTS "consent_receipts_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "screenname_history" DROP CONSTRAINT IF EXISTS "screenname_history_user_id_users_id_fk";
