-- Migration: add_phase9_models
-- Purpose: Add tables for Phase 9 MongoDB decommissioning
-- Ticket: N/A - Infrastructure for MongoDB decommissioning
-- Reversible: Yes
--
-- Models: ContactSubmission, NewsletterSignup, EmailMigration, OAuthVerification,
--         BrevoContact, Interaction, MentorSession, IntakeForm

-- =============================================================================
-- ENUMS
-- =============================================================================

-- SessionType enum for mentoring
CREATE TYPE "SessionType" AS ENUM ('artistic', 'knowledge_transfer', 'panamia_planning', 'pana_support');

-- SessionStatus enum for mentoring
CREATE TYPE "SessionStatus" AS ENUM ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'declined');

-- IntakeFormType enum for intake forms
CREATE TYPE "IntakeFormType" AS ENUM ('art', 'apparel', 'food', 'goods', 'org', 'services');

-- =============================================================================
-- FORM SUBMISSIONS
-- =============================================================================

-- Contact form submissions
CREATE TABLE "contact_submissions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

-- Newsletter signups
CREATE TABLE "newsletter_signups" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "signupType" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "newsletter_signups_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- EMAIL & OAUTH VERIFICATION
-- =============================================================================

-- Email migration tokens
CREATE TABLE "email_migrations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "oldEmail" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "migrationToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_migrations_pkey" PRIMARY KEY ("id")
);

-- OAuth verification tokens
CREATE TABLE "oauth_verifications" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "oauthProfile" JSONB NOT NULL,

    CONSTRAINT "oauth_verifications_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- EXTERNAL SERVICES
-- =============================================================================

-- Brevo (Sendinblue) contact sync
CREATE TABLE "brevo_contacts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "brevoId" INTEGER NOT NULL,
    "listIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "brevo_contacts_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- ANALYTICS & INTERACTIONS
-- =============================================================================

-- User interactions for analytics
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "action" TEXT,
    "affiliate" TEXT,
    "points" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- MENTORING
-- =============================================================================

-- Mentoring sessions
CREATE TABLE "mentor_sessions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mentorEmail" TEXT NOT NULL,
    "menteeEmail" TEXT NOT NULL,
    "mentorUserId" TEXT,
    "menteeUserId" TEXT,
    "sessionId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "topic" TEXT NOT NULL,
    "sessionType" "SessionType" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "declinedAt" TIMESTAMP(3),
    "declinedBy" TEXT,
    "declineReason" TEXT,

    CONSTRAINT "mentor_sessions_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- INTAKE FORMS
-- =============================================================================

-- Consolidated intake forms
CREATE TABLE "intake_forms" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "formType" "IntakeFormType" NOT NULL,
    "name" TEXT,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "formData" JSONB NOT NULL,

    CONSTRAINT "intake_forms_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- UNIQUE CONSTRAINTS
-- =============================================================================

CREATE UNIQUE INDEX "newsletter_signups_email_key" ON "newsletter_signups"("email");
CREATE UNIQUE INDEX "email_migrations_migrationToken_key" ON "email_migrations"("migrationToken");
CREATE UNIQUE INDEX "oauth_verifications_verificationToken_key" ON "oauth_verifications"("verificationToken");
CREATE UNIQUE INDEX "brevo_contacts_email_key" ON "brevo_contacts"("email");
CREATE UNIQUE INDEX "mentor_sessions_sessionId_key" ON "mentor_sessions"("sessionId");
CREATE UNIQUE INDEX "intake_forms_email_key" ON "intake_forms"("email");

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Contact submissions indexes
CREATE INDEX "contact_submissions_email_idx" ON "contact_submissions"("email");
CREATE INDEX "contact_submissions_createdAt_idx" ON "contact_submissions"("createdAt" DESC);

-- Newsletter signups indexes
CREATE INDEX "newsletter_signups_createdAt_idx" ON "newsletter_signups"("createdAt" DESC);

-- Email migrations indexes
CREATE INDEX "email_migrations_userId_idx" ON "email_migrations"("userId");
CREATE INDEX "email_migrations_newEmail_idx" ON "email_migrations"("newEmail");
CREATE INDEX "email_migrations_migrationToken_idx" ON "email_migrations"("migrationToken");
CREATE INDEX "email_migrations_expiresAt_idx" ON "email_migrations"("expiresAt");

-- OAuth verifications indexes
CREATE INDEX "oauth_verifications_email_idx" ON "oauth_verifications"("email");
CREATE INDEX "oauth_verifications_verificationToken_idx" ON "oauth_verifications"("verificationToken");
CREATE INDEX "oauth_verifications_provider_providerAccountId_idx" ON "oauth_verifications"("provider", "providerAccountId");
CREATE INDEX "oauth_verifications_expiresAt_idx" ON "oauth_verifications"("expiresAt");

-- Interactions indexes
CREATE INDEX "interactions_email_idx" ON "interactions"("email");
CREATE INDEX "interactions_createdAt_idx" ON "interactions"("createdAt" DESC);
CREATE INDEX "interactions_action_idx" ON "interactions"("action");

-- Mentor sessions indexes
CREATE INDEX "mentor_sessions_mentorEmail_scheduledAt_idx" ON "mentor_sessions"("mentorEmail", "scheduledAt" DESC);
CREATE INDEX "mentor_sessions_menteeEmail_scheduledAt_idx" ON "mentor_sessions"("menteeEmail", "scheduledAt" DESC);
CREATE INDEX "mentor_sessions_mentorUserId_idx" ON "mentor_sessions"("mentorUserId");
CREATE INDEX "mentor_sessions_menteeUserId_idx" ON "mentor_sessions"("menteeUserId");
CREATE INDEX "mentor_sessions_status_idx" ON "mentor_sessions"("status");
CREATE INDEX "mentor_sessions_scheduledAt_idx" ON "mentor_sessions"("scheduledAt");

-- Intake forms indexes
CREATE INDEX "intake_forms_email_idx" ON "intake_forms"("email");
CREATE INDEX "intake_forms_formType_idx" ON "intake_forms"("formType");
CREATE INDEX "intake_forms_complete_idx" ON "intake_forms"("complete");

-- =============================================================================
-- FOREIGN KEYS
-- =============================================================================

-- Mentor sessions foreign keys to users
ALTER TABLE "mentor_sessions" ADD CONSTRAINT "mentor_sessions_mentorUserId_fkey" FOREIGN KEY ("mentorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mentor_sessions" ADD CONSTRAINT "mentor_sessions_menteeUserId_fkey" FOREIGN KEY ("menteeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
