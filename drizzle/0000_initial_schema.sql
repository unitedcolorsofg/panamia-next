-- Migration: 0000_initial_schema
-- Purpose: Initial schema creation — establishes all 23 tables, 8 enums, indexes, and FK constraints for the Pana Mia Club platform
-- Ticket: N/A
-- Reversible: No
--
-- Dependencies: None
-- Data Migration: None
--
-- Rollback:
--   DROP SCHEMA public CASCADE;
--   CREATE SCHEMA public;
--
-- =============================================================================

CREATE TYPE "public"."account_type" AS ENUM('personal', 'small_business', 'hybrid', 'other');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('draft', 'pending_review', 'revision_needed', 'published', 'removed');--> statement-breakpoint
CREATE TYPE "public"."article_type" AS ENUM('business_update', 'community_commentary');--> statement-breakpoint
CREATE TYPE "public"."intake_form_type" AS ENUM('art', 'apparel', 'food', 'goods', 'org', 'services');--> statement-breakpoint
CREATE TYPE "public"."membership_level" AS ENUM('free', 'basic', 'premium', 'business', 'partner');--> statement-breakpoint
CREATE TYPE "public"."notification_activity_type" AS ENUM('Invite', 'Accept', 'Reject', 'Create', 'Update', 'Delete', 'Announce', 'Like', 'Follow', 'Undo');--> statement-breakpoint
CREATE TYPE "public"."notification_context" AS ENUM('coauthor', 'review', 'article', 'mentoring', 'mention', 'follow', 'message', 'system');--> statement-breakpoint
CREATE TYPE "public"."notification_object_type" AS ENUM('article', 'profile', 'session', 'comment');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'declined');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('artistic', 'knowledge_transfer', 'panamia_planning', 'pana_support');--> statement-breakpoint
CREATE TYPE "public"."social_follow_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "article_announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"article_id" text NOT NULL,
	"author_id" text NOT NULL,
	"actor_id" text,
	"content" text NOT NULL,
	"status_id" text,
	CONSTRAINT "article_announcements_status_id_unique" UNIQUE("status_id")
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"excerpt" text,
	"cover_image" text,
	"article_type" "article_type" NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"author_id" text NOT NULL,
	"co_authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reviewed_by" jsonb,
	"in_reply_to" text,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"removal_reason" text,
	"reading_time" integer DEFAULT 1 NOT NULL,
	"mastodon_post_url" text,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "brevo_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"email" text NOT NULL,
	"brevo_id" integer NOT NULL,
	"list_ids" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
	"synced_at" timestamp with time zone,
	CONSTRAINT "brevo_contacts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"message" text,
	"acknowledged" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_migrations" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"user_id" text NOT NULL,
	"old_email" text NOT NULL,
	"new_email" text NOT NULL,
	"migration_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "email_migrations_migration_token_unique" UNIQUE("migration_token")
);
--> statement-breakpoint
CREATE TABLE "intake_forms" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"email" text NOT NULL,
	"form_type" "intake_form_type" NOT NULL,
	"name" text,
	"complete" boolean DEFAULT false NOT NULL,
	"form_data" jsonb NOT NULL,
	CONSTRAINT "intake_forms_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"email" text NOT NULL,
	"action" text,
	"affiliate" text,
	"points" integer,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "mentor_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"mentor_email" text NOT NULL,
	"mentee_email" text NOT NULL,
	"mentor_user_id" text,
	"mentee_user_id" text,
	"session_id" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration" integer DEFAULT 60 NOT NULL,
	"topic" text NOT NULL,
	"session_type" "session_type" NOT NULL,
	"status" "session_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"cancel_reason" text,
	"declined_at" timestamp with time zone,
	"declined_by" text,
	"decline_reason" text,
	CONSTRAINT "mentor_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "newsletter_signups" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"signup_type" text,
	"acknowledged" boolean DEFAULT false NOT NULL,
	CONSTRAINT "newsletter_signups_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"type" "notification_activity_type" NOT NULL,
	"actor" text NOT NULL,
	"target" text NOT NULL,
	"object" text,
	"context" "notification_context" NOT NULL,
	"actor_screenname" text,
	"actor_name" text,
	"object_type" "notification_object_type",
	"object_title" text,
	"object_url" text,
	"message" text,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"email_sent" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp with time zone,
	"email_preference_key" text,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oauth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"email" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"verification_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"oauth_profile" jsonb NOT NULL,
	CONSTRAINT "oauth_verifications_verification_token_unique" UNIQUE("verification_token")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone_number" text,
	"pronouns" text,
	"primary_image_id" text,
	"primary_image_cdn" text,
	"address_name" text,
	"address_line1" text,
	"address_line2" text,
	"address_line3" text,
	"address_locality" text,
	"address_region" text,
	"address_postal_code" text,
	"address_country" text,
	"address_lat" numeric(10, 7),
	"address_lng" numeric(10, 7),
	"address_google_place_id" text,
	"address_hours" text,
	"active" boolean DEFAULT false NOT NULL,
	"locally_based" text,
	"membership_level" "membership_level" DEFAULT 'free' NOT NULL,
	"descriptions" jsonb,
	"socials" jsonb,
	"gallery_images" jsonb,
	"categories" jsonb,
	"counties" jsonb,
	"locations" jsonb,
	"geo" jsonb,
	"mentoring" jsonb,
	"availability" jsonb,
	"verification" jsonb,
	"roles" jsonb,
	"gentedepana" jsonb,
	"status" jsonb,
	"administrative" jsonb,
	"linked_profiles" jsonb,
	"whatsapp_community" boolean DEFAULT false NOT NULL,
	"affiliate" text,
	"social_eligible" boolean DEFAULT true NOT NULL,
	"social_eligible_at" timestamp with time zone,
	"social_ineligible_reason" text,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "screenname_history" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"screenname" text NOT NULL,
	"user_id" text NOT NULL,
	"redirect_to" text,
	CONSTRAINT "screenname_history_screenname_unique" UNIQUE("screenname")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_actors" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"username" text NOT NULL,
	"domain" text NOT NULL,
	"profile_id" text,
	"uri" text NOT NULL,
	"inbox_url" text NOT NULL,
	"outbox_url" text NOT NULL,
	"followers_url" text NOT NULL,
	"following_url" text NOT NULL,
	"shared_inbox_url" text,
	"public_key" text NOT NULL,
	"private_key" text,
	"name" text,
	"summary" text,
	"icon_url" text,
	"header_url" text,
	"following_count" integer DEFAULT 0 NOT NULL,
	"followers_count" integer DEFAULT 0 NOT NULL,
	"status_count" integer DEFAULT 0 NOT NULL,
	"manually_approves_followers" boolean DEFAULT false NOT NULL,
	CONSTRAINT "social_actors_profile_id_unique" UNIQUE("profile_id"),
	CONSTRAINT "social_actors_uri_unique" UNIQUE("uri")
);
--> statement-breakpoint
CREATE TABLE "social_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"status_id" text NOT NULL,
	"type" text NOT NULL,
	"media_type" text,
	"url" text NOT NULL,
	"preview_url" text,
	"remote_url" text,
	"name" text,
	"description" text,
	"blurhash" text,
	"width" integer,
	"height" integer,
	"peaks" jsonb
);
--> statement-breakpoint
CREATE TABLE "social_follows" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"actor_id" text NOT NULL,
	"target_actor_id" text NOT NULL,
	"uri" text,
	"status" "social_follow_status" DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "social_follows_uri_unique" UNIQUE("uri")
);
--> statement-breakpoint
CREATE TABLE "social_likes" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"actor_id" text NOT NULL,
	"status_id" text NOT NULL,
	"uri" text,
	CONSTRAINT "social_likes_uri_unique" UNIQUE("uri")
);
--> statement-breakpoint
CREATE TABLE "social_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"uri" text NOT NULL,
	"actor_id" text NOT NULL,
	"article_id" text,
	"type" text DEFAULT 'Note' NOT NULL,
	"content" text,
	"content_warning" text,
	"url" text,
	"in_reply_to_uri" text,
	"in_reply_to_id" text,
	"recipient_to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recipient_cc" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published" timestamp with time zone,
	"is_draft" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"location" jsonb,
	"replies_count" integer DEFAULT 0 NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"announces_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "social_statuses_uri_unique" UNIQUE("uri")
);
--> statement-breakpoint
CREATE TABLE "social_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"status_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"href" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"name" text,
	"image" text,
	"screenname" text,
	"last_screenname_change" timestamp with time zone,
	"role" text DEFAULT 'user' NOT NULL,
	"account_type" "account_type" DEFAULT 'personal' NOT NULL,
	"locked_at" timestamp with time zone,
	"alternate_emails" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"notification_preferences" jsonb,
	"zip_code" text,
	"affiliate" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_screenname_unique" UNIQUE("screenname")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_unique" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "article_announcements_article_author_unique" ON "article_announcements" USING btree ("article_id","author_id");--> statement-breakpoint
CREATE INDEX "article_announcements_article_id_idx" ON "article_announcements" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "article_announcements_author_id_idx" ON "article_announcements" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "articles_status_published_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "articles_author_status_idx" ON "articles" USING btree ("author_id","status");--> statement-breakpoint
CREATE INDEX "articles_in_reply_to_idx" ON "articles" USING btree ("in_reply_to");--> statement-breakpoint
CREATE INDEX "contact_submissions_email_idx" ON "contact_submissions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "contact_submissions_created_at_idx" ON "contact_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_migrations_user_id_idx" ON "email_migrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_migrations_new_email_idx" ON "email_migrations" USING btree ("new_email");--> statement-breakpoint
CREATE INDEX "email_migrations_migration_token_idx" ON "email_migrations" USING btree ("migration_token");--> statement-breakpoint
CREATE INDEX "email_migrations_expires_at_idx" ON "email_migrations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "intake_forms_email_idx" ON "intake_forms" USING btree ("email");--> statement-breakpoint
CREATE INDEX "intake_forms_form_type_idx" ON "intake_forms" USING btree ("form_type");--> statement-breakpoint
CREATE INDEX "intake_forms_complete_idx" ON "intake_forms" USING btree ("complete");--> statement-breakpoint
CREATE INDEX "interactions_email_idx" ON "interactions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "interactions_created_at_idx" ON "interactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "interactions_action_idx" ON "interactions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "mentor_sessions_mentor_email_scheduled_idx" ON "mentor_sessions" USING btree ("mentor_email","scheduled_at");--> statement-breakpoint
CREATE INDEX "mentor_sessions_mentee_email_scheduled_idx" ON "mentor_sessions" USING btree ("mentee_email","scheduled_at");--> statement-breakpoint
CREATE INDEX "mentor_sessions_mentor_user_id_idx" ON "mentor_sessions" USING btree ("mentor_user_id");--> statement-breakpoint
CREATE INDEX "mentor_sessions_mentee_user_id_idx" ON "mentor_sessions" USING btree ("mentee_user_id");--> statement-breakpoint
CREATE INDEX "mentor_sessions_status_idx" ON "mentor_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mentor_sessions_scheduled_at_idx" ON "mentor_sessions" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "newsletter_signups_created_at_idx" ON "newsletter_signups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_target_read_created_idx" ON "notifications" USING btree ("target","read","created_at");--> statement-breakpoint
CREATE INDEX "notifications_target_context_created_idx" ON "notifications" USING btree ("target","context","created_at");--> statement-breakpoint
CREATE INDEX "notifications_expires_at_idx" ON "notifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_verifications_email_idx" ON "oauth_verifications" USING btree ("email");--> statement-breakpoint
CREATE INDEX "oauth_verifications_verification_token_idx" ON "oauth_verifications" USING btree ("verification_token");--> statement-breakpoint
CREATE INDEX "oauth_verifications_provider_account_idx" ON "oauth_verifications" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "oauth_verifications_expires_at_idx" ON "oauth_verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "profiles_email_idx" ON "profiles" USING btree ("email");--> statement-breakpoint
CREATE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_active_idx" ON "profiles" USING btree ("active");--> statement-breakpoint
CREATE INDEX "screenname_history_user_id_idx" ON "screenname_history" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_actors_username_domain_unique" ON "social_actors" USING btree ("username","domain");--> statement-breakpoint
CREATE INDEX "social_actors_domain_idx" ON "social_actors" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "social_actors_profile_id_idx" ON "social_actors" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "social_attachments_status_id_idx" ON "social_attachments" USING btree ("status_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_follows_actor_target_unique" ON "social_follows" USING btree ("actor_id","target_actor_id");--> statement-breakpoint
CREATE INDEX "social_follows_actor_id_idx" ON "social_follows" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "social_follows_target_actor_id_idx" ON "social_follows" USING btree ("target_actor_id");--> statement-breakpoint
CREATE INDEX "social_follows_status_idx" ON "social_follows" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "social_likes_actor_status_unique" ON "social_likes" USING btree ("actor_id","status_id");--> statement-breakpoint
CREATE INDEX "social_likes_actor_id_idx" ON "social_likes" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "social_likes_status_id_idx" ON "social_likes" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "social_statuses_actor_published_idx" ON "social_statuses" USING btree ("actor_id","published");--> statement-breakpoint
CREATE INDEX "social_statuses_article_id_idx" ON "social_statuses" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "social_statuses_in_reply_to_uri_idx" ON "social_statuses" USING btree ("in_reply_to_uri");--> statement-breakpoint
CREATE INDEX "social_statuses_in_reply_to_id_idx" ON "social_statuses" USING btree ("in_reply_to_id");--> statement-breakpoint
CREATE INDEX "social_tags_status_id_idx" ON "social_tags" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "social_tags_type_name_idx" ON "social_tags" USING btree ("type","name");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_tokens_identifier_token_unique" ON "verification_tokens" USING btree ("identifier","token");