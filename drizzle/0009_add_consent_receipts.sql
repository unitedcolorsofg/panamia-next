-- Migration: 0009_add_consent_receipts
-- Purpose: Phase 3 consent infrastructure — store proof of user consent to
--          terms/privacy documents and their modules. Receipts serve as legal
--          records and suppress repeat consent prompts. Major version bumps
--          re-trigger consent; minor do not. Receipts are auto-purged annually
--          (doubles as IP address expungement).
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: 0000_initial_schema (users table)
-- Data Migration: None
--
-- Rollback:
--   DROP TABLE IF EXISTS "consent_receipts";
--
-- =============================================================================

CREATE TABLE "consent_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document" text NOT NULL,
	"module" text,
	"version" text NOT NULL,
	"major_version" integer NOT NULL,
	"ip" text,
	"gpc_detected" boolean NOT NULL DEFAULT false,
	"created_at" timestamp with time zone NOT NULL
);--> statement-breakpoint
CREATE INDEX "consent_receipts_user_id_idx" ON "consent_receipts" ("user_id");--> statement-breakpoint
CREATE INDEX "consent_receipts_lookup_idx" ON "consent_receipts" ("user_id", "document", "module", "major_version");--> statement-breakpoint
