-- Migration: 0012_venue_registration_fields
-- Purpose: Expand venues schema for the new /form/submit-venue wizard.
--          Adds venue taxonomy (type/environment/usage), ADA field, parcel
--          tracking for dedup, fire_capacity as a hard RSVP cap, first-class
--          rental/pricing and insurance fields, and JSONB blobs for AV
--          infrastructure and safety notes. Extends parking_options enum.
-- Ticket: N/A
-- Reversible: Partial (enum value additions cannot be dropped cleanly)
--
-- Rollback:
--   DROP INDEX IF EXISTS "venues_parcel_unique_idx";
--   ALTER TABLE "venues"
--     DROP COLUMN IF EXISTS "fire_capacity",
--     DROP COLUMN IF EXISTS "parcel_control_number",
--     DROP COLUMN IF EXISTS "parcel_unit",
--     DROP COLUMN IF EXISTS "venue_type",
--     DROP COLUMN IF EXISTS "venue_environment",
--     DROP COLUMN IF EXISTS "venue_usage",
--     DROP COLUMN IF EXISTS "ada_accessibility",
--     DROP COLUMN IF EXISTS "parking_instructions",
--     DROP COLUMN IF EXISTS "has_liquor_license",
--     DROP COLUMN IF EXISTS "house_rules",
--     DROP COLUMN IF EXISTS "owner_contact",
--     DROP COLUMN IF EXISTS "av_infrastructure",
--     DROP COLUMN IF EXISTS "safety",
--     DROP COLUMN IF EXISTS "building_plans_url",
--     DROP COLUMN IF EXISTS "supporting_docs_urls",
--     DROP COLUMN IF EXISTS "is_free",
--     DROP COLUMN IF EXISTS "rental_model",
--     DROP COLUMN IF EXISTS "rental_pricing",
--     DROP COLUMN IF EXISTS "booking_instructions",
--     DROP COLUMN IF EXISTS "insurance_coi_url",
--     DROP COLUMN IF EXISTS "insurance_coi_expires_at",
--     DROP COLUMN IF EXISTS "insurance_notes";
--   DROP TYPE IF EXISTS "venue_type";
--   DROP TYPE IF EXISTS "venue_environment";
--   DROP TYPE IF EXISTS "venue_usage";
--   DROP TYPE IF EXISTS "ada_accessibility";
--   DROP TYPE IF EXISTS "rental_model";
--   DROP TYPE IF EXISTS "venue_ownership";
--

-- ---------------------------------------------------------------------------
-- New enums
-- ---------------------------------------------------------------------------

CREATE TYPE "venue_type" AS ENUM (
  'bar_restaurant',
  'library_civic',
  'park_outdoor_public',
  'private_residence',
  'religious_community_hall',
  'coworking_office',
  'gallery_museum',
  'theater_performance',
  'studio_practice',
  'classroom_school',
  'beach_waterfront',
  'hotel_ballroom',
  'warehouse_industrial',
  'rooftop',
  'other'
);

CREATE TYPE "venue_environment" AS ENUM ('indoor', 'outdoor', 'mixed');

CREATE TYPE "venue_usage" AS ENUM ('single_purpose', 'mixed_use');

CREATE TYPE "ada_accessibility" AS ENUM ('yes', 'partial', 'none', 'unknown');

CREATE TYPE "rental_model" AS ENUM (
  'free',
  'hourly',
  'flat',
  'tickets',
  'request_quote',
  'revenue_share',
  'other'
);

CREATE TYPE "venue_ownership" AS ENUM ('private', 'public', 'nonprofit', 'unknown');

-- ---------------------------------------------------------------------------
-- Extend existing parking_options enum
-- ---------------------------------------------------------------------------

ALTER TYPE "parking_options" ADD VALUE IF NOT EXISTS 'limited_garage';
ALTER TYPE "parking_options" ADD VALUE IF NOT EXISTS 'good_luck';

-- ---------------------------------------------------------------------------
-- venues: new columns
-- ---------------------------------------------------------------------------

ALTER TABLE "venues"
  ADD COLUMN "fire_capacity" integer,
  ADD COLUMN "parcel_control_number" text,
  ADD COLUMN "parcel_unit" text,
  ADD COLUMN "venue_type" "venue_type",
  ADD COLUMN "venue_environment" "venue_environment",
  ADD COLUMN "venue_usage" "venue_usage",
  ADD COLUMN "venue_ownership" "venue_ownership" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "ada_accessibility" "ada_accessibility" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "parking_instructions" text,
  ADD COLUMN "has_liquor_license" boolean NOT NULL DEFAULT false,
  ADD COLUMN "house_rules" text,
  ADD COLUMN "owner_contact" jsonb,
  ADD COLUMN "av_infrastructure" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "safety" jsonb,
  ADD COLUMN "building_plans_url" text,
  ADD COLUMN "supporting_docs_urls" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "is_free" boolean NOT NULL DEFAULT false,
  ADD COLUMN "rental_model" "rental_model",
  ADD COLUMN "rental_pricing" jsonb,
  ADD COLUMN "booking_instructions" text,
  ADD COLUMN "insurance_coi_url" text,
  ADD COLUMN "insurance_coi_expires_at" timestamp with time zone,
  ADD COLUMN "insurance_notes" text;

-- Seed the pre-existing Pana MIA Main Office row with a fire_capacity so
-- the NOT NULL constraint can be enforced. 40 is a reasonable default for
-- a small office / training space and can be edited by admins.
UPDATE "venues" SET "fire_capacity" = 40 WHERE "slug" = 'pana-mia-main-office';

-- Any other rows: default to 0 (forces admin to update before RSVP works).
UPDATE "venues" SET "fire_capacity" = 0 WHERE "fire_capacity" IS NULL;

ALTER TABLE "venues" ALTER COLUMN "fire_capacity" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Parcel uniqueness: partial unique index so (pcn, unit) is unique when pcn
-- is provided. Outdoor/waterfront venues without a parcel can coexist.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "venues_parcel_unique_idx"
  ON "venues" ("parcel_control_number", COALESCE("parcel_unit", ''))
  WHERE "parcel_control_number" IS NOT NULL;

CREATE INDEX "venues_type_idx" ON "venues" ("venue_type");
CREATE INDEX "venues_is_free_idx" ON "venues" ("is_free");
