-- Migration: add_social_layer
-- Purpose: Add social/ActivityPub tables and profile social eligibility columns
-- Ticket: N/A - Social layer Phase 2-4
-- Reversible: Yes
--
-- Rollback:
--   DROP TABLE IF EXISTS "social_tags";
--   DROP TABLE IF EXISTS "social_attachments";
--   DROP TABLE IF EXISTS "social_likes";
--   DROP TABLE IF EXISTS "social_follows";
--   DROP TABLE IF EXISTS "article_announcements";
--   DROP TABLE IF EXISTS "social_statuses";
--   DROP TABLE IF EXISTS "social_actors";
--   DROP TYPE IF EXISTS "SocialFollowStatus";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "socialEligible";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "socialEligibleAt";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "socialIneligibleReason";

-- =============================================================================
-- PROFILE SOCIAL COLUMNS
-- =============================================================================

ALTER TABLE "profiles" ADD COLUMN "socialEligible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "profiles" ADD COLUMN "socialEligibleAt" TIMESTAMP(3);
ALTER TABLE "profiles" ADD COLUMN "socialIneligibleReason" TEXT;

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE "SocialFollowStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- =============================================================================
-- SOCIAL ACTORS
-- =============================================================================

CREATE TABLE "social_actors" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- Identity
    "username" TEXT NOT NULL,
    "domain" TEXT NOT NULL,

    -- Link to local profile (null for remote actors)
    "profileId" TEXT,

    -- ActivityPub URIs
    "uri" TEXT NOT NULL,
    "inboxUrl" TEXT NOT NULL,
    "outboxUrl" TEXT NOT NULL,
    "followersUrl" TEXT NOT NULL,
    "followingUrl" TEXT NOT NULL,
    "sharedInboxUrl" TEXT,

    -- HTTP Signature keys
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT,

    -- Profile metadata
    "name" TEXT,
    "summary" TEXT,
    "iconUrl" TEXT,

    -- Counters (denormalized)
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "statusCount" INTEGER NOT NULL DEFAULT 0,

    -- Settings
    "manuallyApprovesFollowers" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "social_actors_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- SOCIAL STATUSES
-- =============================================================================

CREATE TABLE "social_statuses" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- ActivityPub URI
    "uri" TEXT NOT NULL,

    -- Author
    "actorId" TEXT NOT NULL,

    -- Optional link to article
    "articleId" TEXT,

    -- Content
    "type" TEXT NOT NULL DEFAULT 'Note',
    "content" TEXT,
    "contentWarning" TEXT,
    "url" TEXT,

    -- Threading
    "inReplyToUri" TEXT,
    "inReplyToId" TEXT,

    -- Visibility (ActivityPub addressing)
    "recipientTo" JSONB NOT NULL DEFAULT '[]',
    "recipientCc" JSONB NOT NULL DEFAULT '[]',

    -- Publishing
    "published" TIMESTAMP(3),
    "isDraft" BOOLEAN NOT NULL DEFAULT false,

    -- Counters (denormalized)
    "repliesCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "announcesCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "social_statuses_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- ARTICLE ANNOUNCEMENTS
-- =============================================================================

CREATE TABLE "article_announcements" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- Article being announced
    "articleId" TEXT NOT NULL,

    -- Author
    "authorId" TEXT NOT NULL,

    -- Actor who will post
    "actorId" TEXT,

    -- Draft content
    "content" TEXT NOT NULL,

    -- Published status link
    "statusId" TEXT,

    CONSTRAINT "article_announcements_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- SOCIAL FOLLOWS
-- =============================================================================

CREATE TABLE "social_follows" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- Who is following
    "actorId" TEXT NOT NULL,

    -- Who is being followed
    "targetActorId" TEXT NOT NULL,

    -- ActivityPub URI
    "uri" TEXT,

    -- Status
    "status" "SocialFollowStatus" NOT NULL DEFAULT 'pending',
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "social_follows_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- SOCIAL LIKES
-- =============================================================================

CREATE TABLE "social_likes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Who liked
    "actorId" TEXT NOT NULL,

    -- What was liked
    "statusId" TEXT NOT NULL,

    -- ActivityPub URI
    "uri" TEXT,

    CONSTRAINT "social_likes_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- SOCIAL ATTACHMENTS
-- =============================================================================

CREATE TABLE "social_attachments" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "statusId" TEXT NOT NULL,

    -- Media details
    "type" TEXT NOT NULL,
    "mediaType" TEXT,
    "url" TEXT NOT NULL,
    "previewUrl" TEXT,
    "remoteUrl" TEXT,

    -- Metadata
    "name" TEXT,
    "description" TEXT,
    "blurhash" TEXT,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "social_attachments_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- SOCIAL TAGS
-- =============================================================================

CREATE TABLE "social_tags" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "statusId" TEXT NOT NULL,

    -- Tag details
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "href" TEXT,

    CONSTRAINT "social_tags_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- UNIQUE CONSTRAINTS
-- =============================================================================

CREATE UNIQUE INDEX "social_actors_profileId_key" ON "social_actors"("profileId");
CREATE UNIQUE INDEX "social_actors_uri_key" ON "social_actors"("uri");
CREATE UNIQUE INDEX "social_actors_username_domain_key" ON "social_actors"("username", "domain");

CREATE UNIQUE INDEX "social_statuses_uri_key" ON "social_statuses"("uri");

CREATE UNIQUE INDEX "article_announcements_statusId_key" ON "article_announcements"("statusId");
CREATE UNIQUE INDEX "article_announcements_articleId_authorId_key" ON "article_announcements"("articleId", "authorId");

CREATE UNIQUE INDEX "social_follows_uri_key" ON "social_follows"("uri");
CREATE UNIQUE INDEX "social_follows_actorId_targetActorId_key" ON "social_follows"("actorId", "targetActorId");

CREATE UNIQUE INDEX "social_likes_uri_key" ON "social_likes"("uri");
CREATE UNIQUE INDEX "social_likes_actorId_statusId_key" ON "social_likes"("actorId", "statusId");

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Social actors indexes
CREATE INDEX "social_actors_domain_idx" ON "social_actors"("domain");
CREATE INDEX "social_actors_profileId_idx" ON "social_actors"("profileId");

-- Social statuses indexes
CREATE INDEX "social_statuses_actorId_published_idx" ON "social_statuses"("actorId", "published" DESC);
CREATE INDEX "social_statuses_articleId_idx" ON "social_statuses"("articleId");
CREATE INDEX "social_statuses_inReplyToUri_idx" ON "social_statuses"("inReplyToUri");
CREATE INDEX "social_statuses_inReplyToId_idx" ON "social_statuses"("inReplyToId");

-- Article announcements indexes
CREATE INDEX "article_announcements_articleId_idx" ON "article_announcements"("articleId");
CREATE INDEX "article_announcements_authorId_idx" ON "article_announcements"("authorId");

-- Social follows indexes
CREATE INDEX "social_follows_actorId_idx" ON "social_follows"("actorId");
CREATE INDEX "social_follows_targetActorId_idx" ON "social_follows"("targetActorId");
CREATE INDEX "social_follows_status_idx" ON "social_follows"("status");

-- Social likes indexes
CREATE INDEX "social_likes_actorId_idx" ON "social_likes"("actorId");
CREATE INDEX "social_likes_statusId_idx" ON "social_likes"("statusId");

-- Social attachments indexes
CREATE INDEX "social_attachments_statusId_idx" ON "social_attachments"("statusId");

-- Social tags indexes
CREATE INDEX "social_tags_statusId_idx" ON "social_tags"("statusId");
CREATE INDEX "social_tags_type_name_idx" ON "social_tags"("type", "name");

-- =============================================================================
-- FOREIGN KEYS
-- =============================================================================

-- Social actors -> profiles
ALTER TABLE "social_actors" ADD CONSTRAINT "social_actors_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Social statuses -> social actors
ALTER TABLE "social_statuses" ADD CONSTRAINT "social_statuses_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "social_actors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Social statuses -> articles
ALTER TABLE "social_statuses" ADD CONSTRAINT "social_statuses_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Social statuses -> self (threading)
ALTER TABLE "social_statuses" ADD CONSTRAINT "social_statuses_inReplyToId_fkey" FOREIGN KEY ("inReplyToId") REFERENCES "social_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Article announcements -> articles
ALTER TABLE "article_announcements" ADD CONSTRAINT "article_announcements_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Article announcements -> users
ALTER TABLE "article_announcements" ADD CONSTRAINT "article_announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Article announcements -> social actors
ALTER TABLE "article_announcements" ADD CONSTRAINT "article_announcements_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "social_actors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Article announcements -> social statuses
ALTER TABLE "article_announcements" ADD CONSTRAINT "article_announcements_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "social_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Social follows -> social actors (follower)
ALTER TABLE "social_follows" ADD CONSTRAINT "social_follows_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "social_actors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Social follows -> social actors (target)
ALTER TABLE "social_follows" ADD CONSTRAINT "social_follows_targetActorId_fkey" FOREIGN KEY ("targetActorId") REFERENCES "social_actors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Social likes -> social actors
ALTER TABLE "social_likes" ADD CONSTRAINT "social_likes_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "social_actors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Social likes -> social statuses
ALTER TABLE "social_likes" ADD CONSTRAINT "social_likes_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "social_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Social attachments -> social statuses
ALTER TABLE "social_attachments" ADD CONSTRAINT "social_attachments_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "social_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Social tags -> social statuses
ALTER TABLE "social_tags" ADD CONSTRAINT "social_tags_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "social_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
