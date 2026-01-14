-- Migration: add_notifications
-- Purpose: Add notifications table for ActivityPub-shaped notification system
-- Ticket: Phase 5 - Migrate notifications from MongoDB to PostgreSQL
-- Reversible: Yes
--
-- Dependencies: 20260112171159_init_auth_tables (users table)
-- Data Migration: Separate script (scripts/migrate-notifications.ts)
--
-- Rollback:
--   DROP TABLE IF EXISTS notifications;
--   DROP TYPE IF EXISTS "NotificationObjectType";
--   DROP TYPE IF EXISTS "NotificationContext";
--   DROP TYPE IF EXISTS "NotificationActivityType";
--
-- UPSTREAM REFERENCE: https://github.com/llun/activities.next
-- =============================================================================

-- CreateEnum
CREATE TYPE "NotificationActivityType" AS ENUM ('Invite', 'Accept', 'Reject', 'Create', 'Update', 'Delete', 'Announce', 'Like', 'Follow', 'Undo');

-- CreateEnum
CREATE TYPE "NotificationContext" AS ENUM ('coauthor', 'review', 'article', 'mentoring', 'mention', 'follow', 'system');

-- CreateEnum
CREATE TYPE "NotificationObjectType" AS ENUM ('article', 'profile', 'session', 'comment');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "NotificationActivityType" NOT NULL,
    "actor" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "object" TEXT,
    "context" "NotificationContext" NOT NULL,
    "actorScreenname" TEXT,
    "actorName" TEXT,
    "objectType" "NotificationObjectType",
    "objectTitle" TEXT,
    "objectUrl" TEXT,
    "message" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "emailPreferenceKey" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Target + read status + creation date (for listing unread)
CREATE INDEX "notifications_target_read_createdAt_idx" ON "notifications"("target", "read", "createdAt" DESC);

-- CreateIndex: Target + context + creation date (for filtering by context)
CREATE INDEX "notifications_target_context_createdAt_idx" ON "notifications"("target", "context", "createdAt" DESC);

-- CreateIndex: Expiration date (for cleanup job)
CREATE INDEX "notifications_expiresAt_idx" ON "notifications"("expiresAt");

-- AddForeignKey: Actor references users
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_fkey" FOREIGN KEY ("actor") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Target references users
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_target_fkey" FOREIGN KEY ("target") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
