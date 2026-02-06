-- =============================================================================
-- Migration: 20260206100000_add_screenname_history
-- Purpose: Track old screennames to prevent reuse by other users; add rate limiting
-- Ticket: N/A (feature enhancement)
-- Reversible: Yes
--
-- Dependencies: users table must exist
-- Data Migration: None
--
-- Rollback:
--   DROP TABLE IF EXISTS "screenname_history";
--   ALTER TABLE "users" DROP COLUMN IF EXISTS "lastScreennameChange";
--
-- =============================================================================

-- Add rate limit field to users
ALTER TABLE "users" ADD COLUMN "lastScreennameChange" TIMESTAMP(3);

-- Create screenname history table
CREATE TABLE "screenname_history" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "screenname" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectTo" TEXT,

    CONSTRAINT "screenname_history_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on screenname (prevents reuse)
CREATE UNIQUE INDEX "screenname_history_screenname_key" ON "screenname_history"("screenname");

-- Index for user lookups
CREATE INDEX "screenname_history_userId_idx" ON "screenname_history"("userId");

-- Foreign key to users table
ALTER TABLE "screenname_history" ADD CONSTRAINT "screenname_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
