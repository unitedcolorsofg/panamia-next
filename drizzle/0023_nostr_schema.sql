-- Migration: 0023_nostr_schema
-- Purpose: Additive Nostr integration merged from the panamia-resilience fork.
--          Adds NIP-29 relay group tables, NIP-56 abuse-report mirror, the two
--          Nostr enums, and the nostr identity/crosspost columns on existing
--          tables (profiles, articles). Purely additive — no existing object is
--          altered destructively, so it is safe to run ahead of the event-model
--          swap in 0024.
-- Ticket: N/A
-- Reversible: Partial (tables/columns drop cleanly; enum DROP requires the
--             dependent columns to be removed first — see Rollback).
--
-- Dependencies: 0022_make_profile_user_id_nullable (profiles, articles exist)
-- Data Migration: None
--
-- Rollback:
--   DROP TABLE IF EXISTS "relay_reports", "relay_group_join_pending",
--     "relay_group_leave_pending", "relay_group_members", "relay_groups";
--   DROP INDEX IF EXISTS "profiles_nostr_pubkey_idx";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "nostr_pubkey_source";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "nostr_pubkey";
--   ALTER TABLE "articles" DROP COLUMN IF EXISTS "nostr_event_id";
--   DROP TYPE IF EXISTS "relay_report_status", "nostr_pubkey_source";
-- =============================================================================

--> statement-breakpoint
CREATE TYPE "relay_report_status" AS ENUM ('open', 'actioned', 'dismissed', 'removed');
--> statement-breakpoint
CREATE TYPE "nostr_pubkey_source" AS ENUM ('issued', 'byo');
--> statement-breakpoint

-- Nostr identity on profiles (issued / BYO, opt-in via the /r flow).
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "nostr_pubkey" text;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "nostr_pubkey_source" "nostr_pubkey_source";
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_nostr_pubkey_unique" UNIQUE("nostr_pubkey");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_nostr_pubkey_idx" ON "profiles" ("nostr_pubkey");
--> statement-breakpoint

-- NIP-23 long-form crosspost id on articles (kind 30023 mirror).
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "nostr_event_id" text;
--> statement-breakpoint

-- NIP-29 relay groups — panamia is sole source of truth.
CREATE TABLE "relay_groups" (
  "group_id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "about" text,
  "picture" text,
  "discoverable" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "relay_groups_discoverable_idx" ON "relay_groups" ("discoverable");
--> statement-breakpoint
CREATE TABLE "relay_group_members" (
  "group_id" text NOT NULL,
  "pubkey" text NOT NULL,
  "joined_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "relay_group_members_pk" ON "relay_group_members" ("group_id", "pubkey");
--> statement-breakpoint
CREATE INDEX "relay_group_members_pubkey_idx" ON "relay_group_members" ("pubkey");
--> statement-breakpoint
CREATE TABLE "relay_group_leave_pending" (
  "group_id" text NOT NULL,
  "pubkey" text NOT NULL,
  "requested_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "relay_group_leave_pending_pk" ON "relay_group_leave_pending" ("group_id", "pubkey");
--> statement-breakpoint
CREATE INDEX "relay_group_leave_pending_requested_at_idx" ON "relay_group_leave_pending" ("requested_at");
--> statement-breakpoint
CREATE TABLE "relay_group_join_pending" (
  "group_id" text NOT NULL,
  "pubkey" text NOT NULL,
  "requested_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "relay_group_join_pending_pk" ON "relay_group_join_pending" ("group_id", "pubkey");
--> statement-breakpoint
CREATE INDEX "relay_group_join_pending_requested_at_idx" ON "relay_group_join_pending" ("requested_at");
--> statement-breakpoint

-- NIP-56 abuse-report mirror (kind 1984 forwarded from the relay).
CREATE TABLE "relay_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "event_id" text NOT NULL,
  "reporter_pubkey" text NOT NULL,
  "target_pubkey" text,
  "target_event_id" text,
  "report_type" text,
  "content" text NOT NULL DEFAULT '',
  "reported_content" text,
  "reported_kind" integer,
  "reported_at" timestamp with time zone NOT NULL,
  "received_at" timestamp with time zone NOT NULL,
  "status" "relay_report_status" NOT NULL DEFAULT 'open',
  "moderation_reason" text,
  "last_moderation_action_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "relay_reports_dedup_idx" ON "relay_reports" ("reporter_pubkey", "target_pubkey", "target_event_id", "report_type");
--> statement-breakpoint
CREATE INDEX "relay_reports_status_idx" ON "relay_reports" ("status");
--> statement-breakpoint
CREATE INDEX "relay_reports_received_at_idx" ON "relay_reports" ("received_at");
--> statement-breakpoint

-- FKs (group_id → relay_groups, ON DELETE CASCADE).
ALTER TABLE "relay_group_members" ADD CONSTRAINT "relay_group_members_group_id_relay_groups_group_id_fk"
  FOREIGN KEY ("group_id") REFERENCES "relay_groups"("group_id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "relay_group_leave_pending" ADD CONSTRAINT "relay_group_leave_pending_group_id_relay_groups_group_id_fk"
  FOREIGN KEY ("group_id") REFERENCES "relay_groups"("group_id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "relay_group_join_pending" ADD CONSTRAINT "relay_group_join_pending_group_id_relay_groups_group_id_fk"
  FOREIGN KEY ("group_id") REFERENCES "relay_groups"("group_id") ON DELETE cascade;
