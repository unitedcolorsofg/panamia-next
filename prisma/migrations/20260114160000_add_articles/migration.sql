-- Migration: add_articles
-- Purpose: Add articles table for ActivityPub-compatible article system
-- Ticket: Phase 6 - Migrate articles from MongoDB to PostgreSQL
-- Reversible: Yes
--
-- Dependencies: 20260112171159_init_auth_tables (users table)
-- Data Migration: Separate script (scripts/migrate-articles.ts)
--
-- Rollback:
--   DROP TABLE IF EXISTS articles;
--   DROP TYPE IF EXISTS "ArticleStatus";
--   DROP TYPE IF EXISTS "ArticleType";
--
-- UPSTREAM REFERENCE: https://github.com/llun/activities.next
-- =============================================================================

-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('business_update', 'community_commentary');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('draft', 'pending_review', 'revision_needed', 'published', 'removed');

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "coverImage" TEXT,
    "articleType" "ArticleType" NOT NULL,
    "tags" TEXT[],
    "authorId" TEXT NOT NULL,
    "coAuthors" JSONB NOT NULL DEFAULT '[]',
    "reviewedBy" JSONB,
    "inReplyTo" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "removedBy" TEXT,
    "removalReason" TEXT,
    "readingTime" INTEGER NOT NULL DEFAULT 1,
    "mastodonPostUrl" TEXT,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique slug
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex: Status + publishedAt for listing published articles
CREATE INDEX "articles_status_publishedAt_idx" ON "articles"("status", "publishedAt" DESC);

-- CreateIndex: Author + status for author's articles
CREATE INDEX "articles_authorId_status_idx" ON "articles"("authorId", "status");

-- CreateIndex: Threading (replies)
CREATE INDEX "articles_inReplyTo_idx" ON "articles"("inReplyTo");

-- AddForeignKey: Author references users
ALTER TABLE "articles" ADD CONSTRAINT "articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Self-reference for threading
ALTER TABLE "articles" ADD CONSTRAINT "articles_inReplyTo_fkey" FOREIGN KEY ("inReplyTo") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: RemovedBy references users
ALTER TABLE "articles" ADD CONSTRAINT "articles_removedBy_fkey" FOREIGN KEY ("removedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
