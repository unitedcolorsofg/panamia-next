-- Migration: 0003_events_enums
-- Purpose: Add 10 new enums for the Events module and extend 2 existing enums
--          with new values for event-related notification contexts/object types.
-- Ticket: N/A
-- Reversible: No (DROP TYPE would require removing all columns using them first)
--
-- Rollback:
--   DROP TYPE IF EXISTS event_status, event_visibility, venue_status,
--     organizer_role, attendee_status, age_restriction, photo_policy,
--     dresscode, parking_options, stream_status;
--   -- ALTER TYPE ... DROP VALUE is not supported in PostgreSQL;
--   -- notification_context and notification_object_type cannot be rolled back.
--
-- IMPORTANT: ALTER TYPE ADD VALUE cannot run inside a transaction.
-- This file intentionally has no BEGIN/COMMIT wrapper.
--
-- Dependencies: 0002_emailverified_boolean
-- =============================================================================

-- New event enums
CREATE TYPE "event_status" AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE "event_visibility" AS ENUM ('public', 'followers', 'invite', 'private');
CREATE TYPE "venue_status" AS ENUM ('pending_review', 'active', 'suspended');
CREATE TYPE "organizer_role" AS ENUM ('host', 'co_organizer', 'volunteer');
CREATE TYPE "attendee_status" AS ENUM ('invited', 'going', 'maybe', 'not_going');
CREATE TYPE "age_restriction" AS ENUM ('all_ages', '18_plus', '21_plus');
CREATE TYPE "photo_policy" AS ENUM ('allowed', 'restricted', 'prohibited');
CREATE TYPE "dresscode" AS ENUM ('none', 'smart_casual', 'formal');
CREATE TYPE "parking_options" AS ENUM ('none', 'street', 'lot', 'garage', 'valet');
CREATE TYPE "stream_status" AS ENUM ('offline', 'connecting', 'live', 'ended');

-- Extend existing notification enums (cannot run in transaction)
ALTER TYPE "notification_context" ADD VALUE IF NOT EXISTS 'event';
ALTER TYPE "notification_object_type" ADD VALUE IF NOT EXISTS 'event';
ALTER TYPE "notification_object_type" ADD VALUE IF NOT EXISTS 'venue';
