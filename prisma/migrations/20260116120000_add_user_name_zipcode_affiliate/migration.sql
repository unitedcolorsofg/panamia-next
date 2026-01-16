-- Migration: add_user_name_zipcode_affiliate
-- Purpose: Add name, zipCode, and affiliate fields to users table
-- Phase 8: Complete MongoDB user model migration
-- Ticket: N/A
-- Reversible: Yes

-- Add name field for display name (also exists in profile for backward compat)
ALTER TABLE "users" ADD COLUMN "name" TEXT;

-- Add zipCode field for user location
ALTER TABLE "users" ADD COLUMN "zipCode" TEXT;

-- Add affiliate JSONB field for affiliate program data
-- Structure: { code, activated, accepted_tos, tier, points }
ALTER TABLE "users" ADD COLUMN "affiliate" JSONB;
