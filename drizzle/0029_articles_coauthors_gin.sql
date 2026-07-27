-- Migration: 0029_articles_coauthors_gin
-- Purpose: Index articles.co_authors (JSONB) so "articles where user X is a
--          co-author" resolves via an index containment lookup
--          (co_authors @> '[{"userId":"X"}]') instead of the full-table scan +
--          application-side filter that /api/articles/my and getArticlesByAuthor
--          previously did. jsonb_path_ops is the smaller/faster GIN opclass and
--          supports the @> operator we use.
-- Ticket: N/A
-- Reversible: Yes -- DROP INDEX "articles_co_authors_gin_idx";
--
-- Dependencies: 0000_initial_schema (articles.co_authors exists)
-- Data Migration: None. Index build only.
-- =============================================================================

CREATE INDEX IF NOT EXISTS "articles_co_authors_gin_idx"
  ON "articles" USING gin ("co_authors" jsonb_path_ops);
