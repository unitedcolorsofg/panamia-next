-- Migration: 0017_add_foreign_keys_and_soft_delete
-- Purpose: Add FK constraints across cross-table id columns; profiles.userId
--   NOT NULL + FK; add userId column/FKs to interactions/mentor_sessions
--   (email→userId code cutover deferred); rename articles.removed* →
--   deleted* per unified soft-delete vocabulary.
-- Ticket: N/A
-- Reversible: Partial (FK additions and renames reversible; profile userId
--   notNull reversal needs caution if orphans were inserted post-migration).
--
-- Dependencies: All existing tables.
-- Data Migration: Inline guard — fails fast if profiles.user_id has NULLs or
--   if any FK violation exists. Run a SELECT pre-check before applying.
--
-- Pre-flight checks (run separately first):
--   SELECT count(*) FROM profiles WHERE user_id IS NULL;
--   SELECT count(*) FROM profiles p
--     LEFT JOIN users u ON u.id = p.user_id WHERE p.user_id IS NOT NULL AND u.id IS NULL;
--   -- repeat for each FK to confirm no orphans.
--
-- Rollback: see bottom of this file.
-- =============================================================================

-- 1. Rename articles.removed_* → deleted_*
ALTER TABLE "articles" RENAME COLUMN "removed_at" TO "deleted_at";
ALTER TABLE "articles" RENAME COLUMN "removed_by" TO "deleted_by";
ALTER TABLE "articles" RENAME COLUMN "removal_reason" TO "deletion_reason";

-- 2. profiles.user_id: enforce NOT NULL (signups always precede profiles).
ALTER TABLE "profiles" ALTER COLUMN "user_id" SET NOT NULL;

-- 3. interactions: add user_id column for future cutover from email join key.
ALTER TABLE "interactions" ADD COLUMN "user_id" text;
CREATE INDEX "interactions_user_id_idx" ON "interactions" ("user_id");

-- =============================================================================
-- Foreign Keys
-- =============================================================================

-- Auth / consent
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "consent_receipts" ADD CONSTRAINT "consent_receipts_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- Profiles
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- Articles
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "articles" ADD CONSTRAINT "articles_deleted_by_users_id_fk"
  FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "articles" ADD CONSTRAINT "articles_in_reply_to_articles_id_fk"
  FOREIGN KEY ("in_reply_to") REFERENCES "articles"("id") ON DELETE SET NULL;

-- Email migrations / mentor / interactions
ALTER TABLE "email_migrations" ADD CONSTRAINT "email_migrations_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "mentor_sessions" ADD CONSTRAINT "mentor_sessions_mentor_user_id_users_id_fk"
  FOREIGN KEY ("mentor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "mentor_sessions" ADD CONSTRAINT "mentor_sessions_mentee_user_id_users_id_fk"
  FOREIGN KEY ("mentee_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- Social / ActivityPub
ALTER TABLE "social_actors" ADD CONSTRAINT "social_actors_profile_id_profiles_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
ALTER TABLE "social_statuses" ADD CONSTRAINT "social_statuses_actor_id_social_actors_id_fk"
  FOREIGN KEY ("actor_id") REFERENCES "social_actors"("id") ON DELETE CASCADE;
ALTER TABLE "social_statuses" ADD CONSTRAINT "social_statuses_article_id_articles_id_fk"
  FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE;
ALTER TABLE "social_statuses" ADD CONSTRAINT "social_statuses_in_reply_to_id_social_statuses_id_fk"
  FOREIGN KEY ("in_reply_to_id") REFERENCES "social_statuses"("id") ON DELETE SET NULL;
ALTER TABLE "social_statuses" ADD CONSTRAINT "social_statuses_event_id_events_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL;
ALTER TABLE "article_announcements" ADD CONSTRAINT "article_announcements_article_id_articles_id_fk"
  FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE;
ALTER TABLE "article_announcements" ADD CONSTRAINT "article_announcements_author_id_users_id_fk"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "article_announcements" ADD CONSTRAINT "article_announcements_actor_id_social_actors_id_fk"
  FOREIGN KEY ("actor_id") REFERENCES "social_actors"("id") ON DELETE SET NULL;
ALTER TABLE "article_announcements" ADD CONSTRAINT "article_announcements_status_id_social_statuses_id_fk"
  FOREIGN KEY ("status_id") REFERENCES "social_statuses"("id") ON DELETE SET NULL;
ALTER TABLE "social_follows" ADD CONSTRAINT "social_follows_actor_id_social_actors_id_fk"
  FOREIGN KEY ("actor_id") REFERENCES "social_actors"("id") ON DELETE CASCADE;
ALTER TABLE "social_follows" ADD CONSTRAINT "social_follows_target_actor_id_social_actors_id_fk"
  FOREIGN KEY ("target_actor_id") REFERENCES "social_actors"("id") ON DELETE CASCADE;
ALTER TABLE "social_likes" ADD CONSTRAINT "social_likes_actor_id_social_actors_id_fk"
  FOREIGN KEY ("actor_id") REFERENCES "social_actors"("id") ON DELETE CASCADE;
ALTER TABLE "social_likes" ADD CONSTRAINT "social_likes_status_id_social_statuses_id_fk"
  FOREIGN KEY ("status_id") REFERENCES "social_statuses"("id") ON DELETE CASCADE;
ALTER TABLE "social_attachments" ADD CONSTRAINT "social_attachments_status_id_social_statuses_id_fk"
  FOREIGN KEY ("status_id") REFERENCES "social_statuses"("id") ON DELETE CASCADE;
ALTER TABLE "social_tags" ADD CONSTRAINT "social_tags_status_id_social_statuses_id_fk"
  FOREIGN KEY ("status_id") REFERENCES "social_statuses"("id") ON DELETE CASCADE;

-- Venues / events
ALTER TABLE "venues" ADD CONSTRAINT "venues_operator_profile_id_profiles_id_fk"
  FOREIGN KEY ("operator_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT;
ALTER TABLE "venues" ADD CONSTRAINT "venues_suspended_by_users_id_fk"
  FOREIGN KEY ("suspended_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "venues" ADD CONSTRAINT "venues_approved_by_users_id_fk"
  FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "events" ADD CONSTRAINT "events_host_profile_id_profiles_id_fk"
  FOREIGN KEY ("host_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk"
  FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT;
ALTER TABLE "events" ADD CONSTRAINT "events_cancelled_by_users_id_fk"
  FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "event_organizers" ADD CONSTRAINT "event_organizers_event_id_events_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;
ALTER TABLE "event_organizers" ADD CONSTRAINT "event_organizers_profile_id_profiles_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
ALTER TABLE "event_organizers" ADD CONSTRAINT "event_organizers_invited_by_users_id_fk"
  FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_events_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_profile_id_profiles_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_invited_by_users_id_fk"
  FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "event_notes" ADD CONSTRAINT "event_notes_event_id_events_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;
ALTER TABLE "event_notes" ADD CONSTRAINT "event_notes_author_profile_id_profiles_id_fk"
  FOREIGN KEY ("author_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
ALTER TABLE "event_photos" ADD CONSTRAINT "event_photos_event_id_events_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;
ALTER TABLE "event_photos" ADD CONSTRAINT "event_photos_uploader_profile_id_profiles_id_fk"
  FOREIGN KEY ("uploader_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
ALTER TABLE "event_photos" ADD CONSTRAINT "event_photos_approved_by_users_id_fk"
  FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL;

-- Screenname history
ALTER TABLE "screenname_history" ADD CONSTRAINT "screenname_history_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- Note: notifications.actor/target/object intentionally omitted — polymorphic.
-- Note: deletion_logs.user_id intentionally omitted — audit log persists past user deletion.

-- =============================================================================
-- Rollback
-- =============================================================================
-- ALTER TABLE "screenname_history" DROP CONSTRAINT "screenname_history_user_id_users_id_fk";
-- ALTER TABLE "event_photos" DROP CONSTRAINT "event_photos_approved_by_users_id_fk";
-- ALTER TABLE "event_photos" DROP CONSTRAINT "event_photos_uploader_profile_id_profiles_id_fk";
-- ALTER TABLE "event_photos" DROP CONSTRAINT "event_photos_event_id_events_id_fk";
-- ALTER TABLE "event_notes" DROP CONSTRAINT "event_notes_author_profile_id_profiles_id_fk";
-- ALTER TABLE "event_notes" DROP CONSTRAINT "event_notes_event_id_events_id_fk";
-- ALTER TABLE "event_attendees" DROP CONSTRAINT "event_attendees_invited_by_users_id_fk";
-- ALTER TABLE "event_attendees" DROP CONSTRAINT "event_attendees_profile_id_profiles_id_fk";
-- ALTER TABLE "event_attendees" DROP CONSTRAINT "event_attendees_event_id_events_id_fk";
-- ALTER TABLE "event_organizers" DROP CONSTRAINT "event_organizers_invited_by_users_id_fk";
-- ALTER TABLE "event_organizers" DROP CONSTRAINT "event_organizers_profile_id_profiles_id_fk";
-- ALTER TABLE "event_organizers" DROP CONSTRAINT "event_organizers_event_id_events_id_fk";
-- ALTER TABLE "events" DROP CONSTRAINT "events_cancelled_by_users_id_fk";
-- ALTER TABLE "events" DROP CONSTRAINT "events_venue_id_venues_id_fk";
-- ALTER TABLE "events" DROP CONSTRAINT "events_host_profile_id_profiles_id_fk";
-- ALTER TABLE "venues" DROP CONSTRAINT "venues_approved_by_users_id_fk";
-- ALTER TABLE "venues" DROP CONSTRAINT "venues_suspended_by_users_id_fk";
-- ALTER TABLE "venues" DROP CONSTRAINT "venues_operator_profile_id_profiles_id_fk";
-- ALTER TABLE "social_tags" DROP CONSTRAINT "social_tags_status_id_social_statuses_id_fk";
-- ALTER TABLE "social_attachments" DROP CONSTRAINT "social_attachments_status_id_social_statuses_id_fk";
-- ALTER TABLE "social_likes" DROP CONSTRAINT "social_likes_status_id_social_statuses_id_fk";
-- ALTER TABLE "social_likes" DROP CONSTRAINT "social_likes_actor_id_social_actors_id_fk";
-- ALTER TABLE "social_follows" DROP CONSTRAINT "social_follows_target_actor_id_social_actors_id_fk";
-- ALTER TABLE "social_follows" DROP CONSTRAINT "social_follows_actor_id_social_actors_id_fk";
-- ALTER TABLE "article_announcements" DROP CONSTRAINT "article_announcements_status_id_social_statuses_id_fk";
-- ALTER TABLE "article_announcements" DROP CONSTRAINT "article_announcements_actor_id_social_actors_id_fk";
-- ALTER TABLE "article_announcements" DROP CONSTRAINT "article_announcements_author_id_users_id_fk";
-- ALTER TABLE "article_announcements" DROP CONSTRAINT "article_announcements_article_id_articles_id_fk";
-- ALTER TABLE "social_statuses" DROP CONSTRAINT "social_statuses_event_id_events_id_fk";
-- ALTER TABLE "social_statuses" DROP CONSTRAINT "social_statuses_in_reply_to_id_social_statuses_id_fk";
-- ALTER TABLE "social_statuses" DROP CONSTRAINT "social_statuses_article_id_articles_id_fk";
-- ALTER TABLE "social_statuses" DROP CONSTRAINT "social_statuses_actor_id_social_actors_id_fk";
-- ALTER TABLE "social_actors" DROP CONSTRAINT "social_actors_profile_id_profiles_id_fk";
-- ALTER TABLE "interactions" DROP CONSTRAINT "interactions_user_id_users_id_fk";
-- ALTER TABLE "mentor_sessions" DROP CONSTRAINT "mentor_sessions_mentee_user_id_users_id_fk";
-- ALTER TABLE "mentor_sessions" DROP CONSTRAINT "mentor_sessions_mentor_user_id_users_id_fk";
-- ALTER TABLE "email_migrations" DROP CONSTRAINT "email_migrations_user_id_users_id_fk";
-- ALTER TABLE "articles" DROP CONSTRAINT "articles_in_reply_to_articles_id_fk";
-- ALTER TABLE "articles" DROP CONSTRAINT "articles_deleted_by_users_id_fk";
-- ALTER TABLE "articles" DROP CONSTRAINT "articles_author_id_users_id_fk";
-- ALTER TABLE "profiles" DROP CONSTRAINT "profiles_user_id_users_id_fk";
-- ALTER TABLE "consent_receipts" DROP CONSTRAINT "consent_receipts_user_id_users_id_fk";
-- ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_users_id_fk";
-- ALTER TABLE "accounts" DROP CONSTRAINT "accounts_user_id_users_id_fk";
-- DROP INDEX "interactions_user_id_idx";
-- ALTER TABLE "interactions" DROP COLUMN "user_id";
-- ALTER TABLE "profiles" ALTER COLUMN "user_id" DROP NOT NULL;
-- ALTER TABLE "articles" RENAME COLUMN "deletion_reason" TO "removal_reason";
-- ALTER TABLE "articles" RENAME COLUMN "deleted_by" TO "removed_by";
-- ALTER TABLE "articles" RENAME COLUMN "deleted_at" TO "removed_at";
