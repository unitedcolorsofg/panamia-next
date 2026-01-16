-- Migration: add_profiles
-- Purpose: Add profiles table for business/personal profiles with core identity columns and flexible JSONB data
-- Ticket: N/A - Phase 7 of MongoDB to PostgreSQL migration
-- Reversible: Yes
--
-- Rollback:
--   DROP TABLE IF EXISTS profiles;
--   DROP TYPE IF EXISTS "MembershipLevel";
--
-- Note: PostgreSQL testing not yet performed

-- CreateEnum
CREATE TYPE "MembershipLevel" AS ENUM ('free', 'basic', 'premium', 'business', 'partner');

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- Link to auth user
    "userId" TEXT,

    -- === CORE IMMUTABLE DATA (columns) ===

    -- Identity
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,

    -- Contact
    "phoneNumber" TEXT,

    -- Pronouns
    "pronouns" TEXT,

    -- Primary Image
    "primaryImageId" TEXT,
    "primaryImageCdn" TEXT,

    -- Primary Address (international-friendly)
    "addressName" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "addressLine3" TEXT,
    "addressLocality" TEXT,
    "addressRegion" TEXT,
    "addressPostalCode" TEXT,
    "addressCountry" TEXT,
    "addressLat" DECIMAL(10,7),
    "addressLng" DECIMAL(10,7),
    "addressGooglePlaceId" TEXT,
    "addressHours" TEXT,

    -- Status/Membership
    "active" BOOLEAN NOT NULL DEFAULT false,
    "locallyBased" TEXT,
    "membershipLevel" "MembershipLevel" NOT NULL DEFAULT 'free',

    -- === EXTENDED FLEXIBLE DATA (JSONB) ===

    "descriptions" JSONB,
    "socials" JSONB,
    "galleryImages" JSONB,
    "categories" JSONB,
    "counties" JSONB,
    "locations" JSONB,
    "geo" JSONB,
    "mentoring" JSONB,
    "availability" JSONB,
    "verification" JSONB,
    "roles" JSONB,
    "gentedepana" JSONB,
    "status" JSONB,
    "administrative" JSONB,
    "linkedProfiles" JSONB,

    -- === OTHER FIELDS ===

    "whatsappCommunity" BOOLEAN NOT NULL DEFAULT false,
    "affiliate" TEXT,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_slug_key" ON "profiles"("slug");

-- CreateIndex
CREATE INDEX "profiles_email_idx" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "profiles_slug_idx" ON "profiles"("slug");

-- CreateIndex
CREATE INDEX "profiles_userId_idx" ON "profiles"("userId");

-- CreateIndex
CREATE INDEX "profiles_active_idx" ON "profiles"("active");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
