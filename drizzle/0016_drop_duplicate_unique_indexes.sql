-- Migration: 0016_drop_duplicate_unique_indexes
-- Purpose: Resolve Supabase duplicate_index advisor. Nine tables each had two
--          unique btree indexes on the same column: one auto-created from a
--          column-level UNIQUE constraint (kept), and one redundant
--          explicit index declared in lib/schema/index.ts (dropped here and
--          removed from the schema).
-- Ticket: N/A (security advisor cleanup)
-- Reversible: Yes (see Rollback below)
--
-- Dependencies: 0015_lockdown_drizzle_migrations
-- Data Migration: None
--
-- Rollback:
--   CREATE UNIQUE INDEX email_migrations_migration_token_idx          ON email_migrations(migration_token);
--   CREATE UNIQUE INDEX events_slug_idx                                ON events(slug);
--   CREATE UNIQUE INDEX events_ical_uid_idx                            ON events(ical_uid);
--   CREATE UNIQUE INDEX intake_forms_email_idx                         ON intake_forms(email);
--   CREATE UNIQUE INDEX oauth_verifications_verification_token_idx     ON oauth_verifications(verification_token);
--   CREATE UNIQUE INDEX profiles_user_id_idx                           ON profiles(user_id);
--   CREATE UNIQUE INDEX profiles_email_idx                             ON profiles(email);
--   CREATE UNIQUE INDEX social_actors_profile_id_idx                   ON social_actors(profile_id);
--   CREATE UNIQUE INDEX venues_slug_idx                                ON venues(slug);
--
-- =============================================================================

DROP INDEX IF EXISTS public.email_migrations_migration_token_idx;
DROP INDEX IF EXISTS public.events_slug_idx;
DROP INDEX IF EXISTS public.events_ical_uid_idx;
DROP INDEX IF EXISTS public.intake_forms_email_idx;
DROP INDEX IF EXISTS public.oauth_verifications_verification_token_idx;
DROP INDEX IF EXISTS public.profiles_user_id_idx;
DROP INDEX IF EXISTS public.profiles_email_idx;
DROP INDEX IF EXISTS public.social_actors_profile_id_idx;
DROP INDEX IF EXISTS public.venues_slug_idx;
