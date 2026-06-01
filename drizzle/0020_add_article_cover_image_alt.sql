-- Migration: 0020_add_article_cover_image_alt
-- Purpose: Add alt text for article cover images so authors can supply an
--          accessible description (screen readers, SEO) alongside the cover
--          image URL in the article editor (/a/new, /a/[slug]/edit). Render
--          sites fall back to the article title when this is empty.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: 0000_initial_schema (articles table)
-- Data Migration: None — nullable column; existing rows remain NULL and fall
--                  back to the article title at render time.
--
-- Rollback:
--   ALTER TABLE "articles" DROP COLUMN "cover_image_alt";
--
-- =============================================================================

ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "cover_image_alt" text;
