-- Migration: 0035_social_statuses_recipients_gin
-- Purpose: Index social_statuses.recipient_to / recipient_cc (JSONB) so the /s
--          timeline queries resolve their ActivityPub addressing filters via an
--          index containment lookup instead of a full-table scan. The social
--          module is fan-out-on-READ by design (see the DESIGN NOTE in
--          lib/federation/wrappers/timeline.ts), so *every* timeline read --
--          home, public, DM inbox, DM sent, and @-me -- filters on these two
--          columns via `recipient_x @> to_jsonb(<uri>::text)`. Neither column
--          had an index. jsonb_path_ops is the smaller/faster GIN opclass and
--          supports the @> operator we use; verified that it serves the
--          top-level-scalar-against-array form these queries emit (a forced
--          index scan returns the same row count as a seq scan).
-- Ticket: N/A
-- Reversible: Yes -- DROP INDEX "social_statuses_recipient_to_gin_idx";
--                    DROP INDEX "social_statuses_recipient_cc_gin_idx";
--
-- Dependencies: 0000_initial_schema (social_statuses.recipient_to / recipient_cc exist)
-- Data Migration: None. Index build only.
-- =============================================================================

CREATE INDEX IF NOT EXISTS "social_statuses_recipient_to_gin_idx"
  ON "social_statuses" USING gin ("recipient_to" jsonb_path_ops);

CREATE INDEX IF NOT EXISTS "social_statuses_recipient_cc_gin_idx"
  ON "social_statuses" USING gin ("recipient_cc" jsonb_path_ops);
