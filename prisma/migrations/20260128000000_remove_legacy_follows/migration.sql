-- Migration: remove_legacy_follows
-- Purpose: Remove legacy UserFollow/UserList features replaced by social layer
-- Ticket: N/A (infrastructure - social layer Phase 3.5)
-- Reversible: No
--
-- Note: This migration removes the legacy following/lists tables.
-- SocialFollow is now the sole follow mechanism (see docs/SOCIAL-ROADMAP.md).

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS "user_list_members";
DROP TABLE IF EXISTS "user_lists";
DROP TABLE IF EXISTS "user_follows";
