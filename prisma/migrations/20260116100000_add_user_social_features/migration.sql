-- Migration: add_user_social_features
-- Purpose: Add social features (following, lists) and additional user fields
-- Phase 8: MongoDB user model consolidation
-- Ticket: N/A
-- Reversible: Yes

-- =============================================================================
-- AccountType Enum
-- =============================================================================
CREATE TYPE "AccountType" AS ENUM ('personal', 'small_business', 'hybrid', 'other');

-- =============================================================================
-- User Table Updates
-- =============================================================================
-- Add new fields from MongoDB user.ts model

ALTER TABLE "users" ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'personal';
ALTER TABLE "users" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "alternateEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "notificationPreferences" JSONB;

-- =============================================================================
-- UserFollow Table (Social Following)
-- =============================================================================
-- Replaces MongoDB user.following[] array with proper junction table

CREATE TABLE "user_follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id")
);

-- Indexes for efficient lookups
CREATE INDEX "user_follows_followerId_idx" ON "user_follows"("followerId");
CREATE INDEX "user_follows_followingId_idx" ON "user_follows"("followingId");

-- Unique constraint: user can only follow another user once
CREATE UNIQUE INDEX "user_follows_followerId_followingId_key" ON "user_follows"("followerId", "followingId");

-- Foreign keys
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followerId_fkey"
    FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followingId_fkey"
    FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- UserList Table (User-curated Lists)
-- =============================================================================
-- Replaces MongoDB userlist collection

CREATE TABLE "user_lists" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_lists_pkey" PRIMARY KEY ("id")
);

-- Index for owner lookups
CREATE INDEX "user_lists_ownerId_idx" ON "user_lists"("ownerId");

-- Foreign key
ALTER TABLE "user_lists" ADD CONSTRAINT "user_lists_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- UserListMember Table (List Membership)
-- =============================================================================
-- Junction table for users in lists

CREATE TABLE "user_list_members" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_list_members_pkey" PRIMARY KEY ("id")
);

-- Indexes for lookups
CREATE INDEX "user_list_members_listId_idx" ON "user_list_members"("listId");
CREATE INDEX "user_list_members_userId_idx" ON "user_list_members"("userId");

-- Unique constraint: user can only be in a list once
CREATE UNIQUE INDEX "user_list_members_listId_userId_key" ON "user_list_members"("listId", "userId");

-- Foreign keys
ALTER TABLE "user_list_members" ADD CONSTRAINT "user_list_members_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "user_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_list_members" ADD CONSTRAINT "user_list_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
