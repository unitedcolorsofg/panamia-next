-- Migration: 0001_better_auth_schema
-- Purpose: Replace NextAuth-shaped accounts/sessions/verification_tokens tables
--          with better-auth column names. No production users — tables are reset.
-- Ticket: N/A
-- Reversible: No (table replacement; no data to preserve)
--
-- Dependencies: 0000_initial_schema
-- Data Migration: None (no production users)
--
-- Rollback:
--   Restore from 0000_initial_schema CREATE TABLE statements for accounts,
--   sessions, and verification_tokens.
--
-- =============================================================================

-- Drop old unique indexes
DROP INDEX IF EXISTS "accounts_provider_account_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "verification_tokens_identifier_token_unique";--> statement-breakpoint

-- Drop old tables
DROP TABLE IF EXISTS "sessions";--> statement-breakpoint
DROP TABLE IF EXISTS "accounts";--> statement-breakpoint
DROP TABLE IF EXISTS "verification_tokens";--> statement-breakpoint

-- Create new accounts table (better-auth schema)
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_unique" ON "accounts" ("provider_id","account_id");--> statement-breakpoint

-- Create new sessions table (better-auth schema)
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint

-- Create new verification_tokens table (better-auth shape, Drizzle export: `verification`)
CREATE TABLE "verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
