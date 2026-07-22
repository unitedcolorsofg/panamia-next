-- Migration: 0028_article_type_staff_update
-- Purpose: Add 'staff_update' as a choice on the article_type enum so admin
--          users can publish official Pana MIA staff updates. Unlike the other
--          two types, a staff update does not require an accepted co-author or
--          an approved reviewer to publish — the admin-only authoring gate is
--          enforced in application code (POST/PATCH /api/articles and the
--          publish route), not in the schema.
-- Ticket: N/A
-- Reversible: No (Postgres does not support removing enum values without
--             recreating the type)
--
-- Dependencies: 0000_initial_schema (article_type enum exists)
-- Data Migration: None. No stored value is rewritten.
-- =============================================================================

ALTER TYPE "public"."article_type" ADD VALUE IF NOT EXISTS 'staff_update';
