/**
 * Drizzle ORM Schema
 *
 * Drizzle schema for all 23 models, 11 enums, and FK relations.
 * All 23 models, 11 enums, and all FK relations are defined here.
 *
 * Column naming: use explicit snake_case column names so the schema is
 * self-documenting and casing config on the drizzle client is not required.
 */

import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// =============================================================================
// Enums
// =============================================================================

export const accountType = pgEnum('account_type', [
  'personal',
  'small_business',
  'hybrid',
  'other',
]);

export const notificationActivityType = pgEnum('notification_activity_type', [
  'Invite',
  'Accept',
  'Reject',
  'Create',
  'Update',
  'Delete',
  'Announce',
  'Like',
  'Follow',
  'Undo',
]);

export const notificationContext = pgEnum('notification_context', [
  'coauthor',
  'review',
  'article',
  'mentoring',
  'mention',
  'follow',
  'message',
  'system',
  'event',
]);

export const notificationObjectType = pgEnum('notification_object_type', [
  'article',
  'profile',
  'session',
  'comment',
  'event',
  'venue',
]);

export const ccLicense = pgEnum('cc_license', ['cc-by-4', 'cc-by-sa-4']);

export const articleType = pgEnum('article_type', [
  'business_update',
  'community_commentary',
]);

export const articleStatus = pgEnum('article_status', [
  'draft',
  'pending_review',
  'revision_needed',
  'published',
  'removed',
]);

export const membershipLevel = pgEnum('membership_level', [
  'free',
  'basic',
  'premium',
  'business',
  'partner',
]);

export const sessionType = pgEnum('session_type', [
  'artistic',
  'knowledge_transfer',
  'panamia_planning',
  'pana_support',
]);

export const sessionStatus = pgEnum('session_status', [
  'pending',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'declined',
]);

export const intakeFormType = pgEnum('intake_form_type', [
  'art',
  'apparel',
  'food',
  'goods',
  'org',
  'services',
]);

export const socialFollowStatus = pgEnum('social_follow_status', [
  'pending',
  'accepted',
  'rejected',
]);

// New Events enums
export const eventStatus = pgEnum('event_status', [
  'draft',
  'published',
  'cancelled',
  'completed',
]);

export const eventVisibility = pgEnum('event_visibility', [
  'public',
  'followers',
  'invite',
  'private',
]);

export const venueStatus = pgEnum('venue_status', [
  'pending_review',
  'active',
  'suspended',
]);

export const organizerRole = pgEnum('organizer_role', [
  'host',
  'co_organizer',
  'volunteer',
]);

export const attendeeStatus = pgEnum('attendee_status', [
  'invited',
  'going',
  'maybe',
  'not_going',
]);

export const ageRestriction = pgEnum('age_restriction', [
  'all_ages',
  '18_plus',
  '21_plus',
]);

export const photoPolicy = pgEnum('photo_policy', [
  'allowed',
  'restricted',
  'prohibited',
]);

export const dresscode = pgEnum('dresscode', [
  'none',
  'smart_casual',
  'formal',
]);

export const parkingOptions = pgEnum('parking_options', [
  'none',
  'street',
  'lot',
  'garage',
  'valet',
]);

export const streamStatus = pgEnum('stream_status', [
  'offline',
  'connecting',
  'live',
  'ended',
]);

// =============================================================================
// Convenience type aliases for enum values
// =============================================================================

export type AccountType = (typeof accountType.enumValues)[number];
export type NotificationActivityType =
  (typeof notificationActivityType.enumValues)[number];
export type NotificationContext =
  (typeof notificationContext.enumValues)[number];
export type NotificationObjectType =
  (typeof notificationObjectType.enumValues)[number];
export type ArticleType = (typeof articleType.enumValues)[number];
export type ArticleStatus = (typeof articleStatus.enumValues)[number];
export type MembershipLevel = (typeof membershipLevel.enumValues)[number];
export type SessionType = (typeof sessionType.enumValues)[number];
export type SessionStatus = (typeof sessionStatus.enumValues)[number];
export type IntakeFormType = (typeof intakeFormType.enumValues)[number];
export type SocialFollowStatus = (typeof socialFollowStatus.enumValues)[number];
export type EventStatus = (typeof eventStatus.enumValues)[number];
export type EventVisibility = (typeof eventVisibility.enumValues)[number];
export type VenueStatus = (typeof venueStatus.enumValues)[number];
export type OrganizerRole = (typeof organizerRole.enumValues)[number];
export type AttendeeStatus = (typeof attendeeStatus.enumValues)[number];
export type AgeRestriction = (typeof ageRestriction.enumValues)[number];
export type PhotoPolicy = (typeof photoPolicy.enumValues)[number];
export type Dresscode = (typeof dresscode.enumValues)[number];
export type ParkingOptions = (typeof parkingOptions.enumValues)[number];
export type StreamStatus = (typeof streamStatus.enumValues)[number];

// =============================================================================
// Auth Tables (better-auth)
// =============================================================================

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  image: text('image'),
  screenname: text('screenname').unique(),
  lastScreennameChange: timestamp('last_screenname_change', {
    withTimezone: true,
  }),
  role: text('role').notNull().default('user'),
  accountType: accountType('account_type').notNull().default('personal'),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  alternateEmails: text('alternate_emails')
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  notificationPreferences: jsonb('notification_preferences'),
  zipCode: text('zip_code'),
  affiliate: jsonb('affiliate'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export const accounts = pgTable(
  'accounts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    providerAccountUnique: uniqueIndex('accounts_provider_account_unique').on(
      table.providerId,
      table.accountId
    ),
  })
);

export const sessions = pgTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  userId: text('user_id').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export const verification = pgTable('verification_tokens', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// =============================================================================
// Consent Receipts
// =============================================================================
// Phase 3 consent infrastructure. Each receipt records a user's consent to a
// specific document ('terms' | 'privacy') and optionally a module ('articles',
// 'social', etc.). module=null represents top-level terms acceptance (signup).
//
// Lookup pattern: find receipt by (user_id, document, module, major_version).
// If found, consent is current — skip prompt. If not, show gate or notice
// (determined by policy.json consent.type, NOT stored on the receipt).
//
// Receipts are auto-purged annually (cron job, not yet implemented). This
// serves dual purpose: expunging stored IP addresses and triggering annual
// re-consent.

export const consentReceipts = pgTable(
  'consent_receipts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id').notNull(),
    // 'terms' | 'privacy'
    document: text('document').notNull(),
    // Module ID (e.g. 'articles', 'social') or null for top-level acceptance
    module: text('module'),
    // Full semver string as recorded at time of consent (e.g. '0.1')
    version: text('version').notNull(),
    // Extracted major version for efficient lookup — only major bumps
    // re-trigger consent
    majorVersion: integer('major_version').notNull(),
    ip: text('ip'),
    gpcDetected: boolean('gpc_detected').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    userIdIdx: index('consent_receipts_user_id_idx').on(table.userId),
    lookupIdx: index('consent_receipts_lookup_idx').on(
      table.userId,
      table.document,
      table.module,
      table.majorVersion
    ),
  })
);

// =============================================================================
// Notifications
// =============================================================================

export const notifications = pgTable(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    type: notificationActivityType('type').notNull(),
    actor: text('actor').notNull(),
    target: text('target').notNull(),
    object: text('object'),
    context: notificationContext('context').notNull(),
    actorScreenname: text('actor_screenname'),
    actorName: text('actor_name'),
    objectType: notificationObjectType('object_type'),
    objectTitle: text('object_title'),
    objectUrl: text('object_url'),
    message: text('message'),
    read: boolean('read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    emailSent: boolean('email_sent').notNull().default(false),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
    emailPreferenceKey: text('email_preference_key'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => ({
    targetReadCreatedIdx: index('notifications_target_read_created_idx').on(
      table.target,
      table.read,
      table.createdAt
    ),
    targetContextCreatedIdx: index(
      'notifications_target_context_created_idx'
    ).on(table.target, table.context, table.createdAt),
    expiresAtIdx: index('notifications_expires_at_idx').on(table.expiresAt),
  })
);

// =============================================================================
// Profiles
// =============================================================================

export const profiles = pgTable(
  'profiles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    userId: text('user_id').unique(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    phoneNumber: text('phone_number'),
    pronouns: text('pronouns'),
    primaryImageId: text('primary_image_id'),
    primaryImageCdn: text('primary_image_cdn'),
    addressName: text('address_name'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    addressLine3: text('address_line3'),
    addressLocality: text('address_locality'),
    addressRegion: text('address_region'),
    addressPostalCode: text('address_postal_code'),
    addressCountry: text('address_country'),
    addressLat: numeric('address_lat', { precision: 10, scale: 7 }),
    addressLng: numeric('address_lng', { precision: 10, scale: 7 }),
    addressGooglePlaceId: text('address_google_place_id'),
    addressHours: text('address_hours'),
    active: boolean('active').notNull().default(false),
    locallyBased: text('locally_based'),
    membershipLevel: membershipLevel('membership_level')
      .notNull()
      .default('free'),
    descriptions: jsonb('descriptions'),
    socials: jsonb('socials'),
    galleryImages: jsonb('gallery_images'),
    categories: jsonb('categories'),
    counties: jsonb('counties'),
    locations: jsonb('locations'),
    geo: jsonb('geo'),
    mentoring: jsonb('mentoring'),
    availability: jsonb('availability'),
    verification: jsonb('verification'),
    roles: jsonb('roles'),
    gentedepana: jsonb('gentedepana'),
    status: jsonb('status'),
    administrative: jsonb('administrative'),
    linkedProfiles: jsonb('linked_profiles'),
    whatsappCommunity: boolean('whatsapp_community').notNull().default(false),
    affiliate: text('affiliate'),
    socialEligible: boolean('social_eligible').notNull().default(true),
    socialEligibleAt: timestamp('social_eligible_at', { withTimezone: true }),
    socialIneligibleReason: text('social_ineligible_reason'),
    // Residence — platform eligibility & volunteer coordination
    // neighborhoods: jsonb array of predefined South Florida neighborhood keys
    // (e.g. ["wynwood", "brickell", "las-olas"]). Users may belong to multiple.
    // Future enhancement: point-and-click map picker.
    neighborhoods: jsonb('neighborhoods'),
    // verifiedZipCode: billing zip from GoHighLevel — NOT user-provided.
    // Used to verify South Florida residency for platform eligibility.
    verifiedZipCode: text('verified_zip_code'),
    // GHL (GoHighLevel CRM)
    ghlContactId: text('ghl_contact_id'),
    ghlOptedOut: boolean('ghl_opted_out').notNull().default(false),
  },
  (table) => ({
    emailIdx: index('profiles_email_idx').on(table.email),
    userIdIdx: index('profiles_user_id_idx').on(table.userId),
    activeIdx: index('profiles_active_idx').on(table.active),
  })
);

// =============================================================================
// Articles
// =============================================================================

export const articles = pgTable(
  'articles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    excerpt: text('excerpt'),
    coverImage: text('cover_image'),
    articleType: articleType('article_type').notNull(),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    authorId: text('author_id').notNull(),
    coAuthors: jsonb('co_authors')
      .notNull()
      .default(sql`'[]'::jsonb`),
    reviewedBy: jsonb('reviewed_by'),
    inReplyTo: text('in_reply_to'),
    status: articleStatus('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedBy: text('removed_by'),
    removalReason: text('removal_reason'),
    readingTime: integer('reading_time').notNull().default(1),
    mastodonPostUrl: text('mastodon_post_url'),
    ccLicense: ccLicense('cc_license').notNull().default('cc-by-sa-4'),
  },
  (table) => ({
    statusPublishedIdx: index('articles_status_published_idx').on(
      table.status,
      table.publishedAt
    ),
    authorStatusIdx: index('articles_author_status_idx').on(
      table.authorId,
      table.status
    ),
    inReplyToIdx: index('articles_in_reply_to_idx').on(table.inReplyTo),
  })
);

// =============================================================================
// Form Submissions
// =============================================================================

export const contactSubmissions = pgTable(
  'contact_submissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    name: text('name').notNull(),
    email: text('email').notNull(),
    message: text('message'),
    acknowledged: boolean('acknowledged').notNull().default(false),
  },
  (table) => ({
    emailIdx: index('contact_submissions_email_idx').on(table.email),
    createdAtIdx: index('contact_submissions_created_at_idx').on(
      table.createdAt
    ),
  })
);

export const newsletterSignups = pgTable(
  'newsletter_signups',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    email: text('email').notNull().unique(),
    name: text('name'),
    signupType: text('signup_type'),
    acknowledged: boolean('acknowledged').notNull().default(false),
  },
  (table) => ({
    createdAtIdx: index('newsletter_signups_created_at_idx').on(
      table.createdAt
    ),
  })
);

// =============================================================================
// Email & OAuth Verification
// =============================================================================

export const emailMigrations = pgTable(
  'email_migrations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    userId: text('user_id').notNull(),
    oldEmail: text('old_email').notNull(),
    newEmail: text('new_email').notNull(),
    migrationToken: text('migration_token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    userIdIdx: index('email_migrations_user_id_idx').on(table.userId),
    newEmailIdx: index('email_migrations_new_email_idx').on(table.newEmail),
    migrationTokenIdx: index('email_migrations_migration_token_idx').on(
      table.migrationToken
    ),
    expiresAtIdx: index('email_migrations_expires_at_idx').on(table.expiresAt),
  })
);

export const oAuthVerifications = pgTable(
  'oauth_verifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    email: text('email').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    verificationToken: text('verification_token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    oauthProfile: jsonb('oauth_profile').notNull(),
  },
  (table) => ({
    emailIdx: index('oauth_verifications_email_idx').on(table.email),
    verificationTokenIdx: index(
      'oauth_verifications_verification_token_idx'
    ).on(table.verificationToken),
    providerAccountIdx: index('oauth_verifications_provider_account_idx').on(
      table.provider,
      table.providerAccountId
    ),
    expiresAtIdx: index('oauth_verifications_expires_at_idx').on(
      table.expiresAt
    ),
  })
);

// =============================================================================
// External Services
// =============================================================================

export const brevoContacts = pgTable('brevo_contacts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  email: text('email').notNull().unique(),
  brevoId: integer('brevo_id').notNull(),
  listIds: integer('list_ids')
    .array()
    .notNull()
    .default(sql`ARRAY[]::integer[]`),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
});

// =============================================================================
// Analytics & Interactions
// =============================================================================

export const interactions = pgTable(
  'interactions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    email: text('email').notNull(),
    action: text('action'),
    affiliate: text('affiliate'),
    points: integer('points'),
    metadata: jsonb('metadata'),
  },
  (table) => ({
    emailIdx: index('interactions_email_idx').on(table.email),
    createdAtIdx: index('interactions_created_at_idx').on(table.createdAt),
    actionIdx: index('interactions_action_idx').on(table.action),
  })
);

// =============================================================================
// Mentoring
// =============================================================================

export const mentorSessions = pgTable(
  'mentor_sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    mentorEmail: text('mentor_email').notNull(),
    menteeEmail: text('mentee_email').notNull(),
    mentorUserId: text('mentor_user_id'),
    menteeUserId: text('mentee_user_id'),
    sessionId: text('session_id').notNull().unique(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    duration: integer('duration').notNull().default(60),
    topic: text('topic').notNull(),
    sessionType: sessionType('session_type').notNull(),
    status: sessionStatus('status').notNull().default('pending'),
    notes: text('notes'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: text('cancelled_by'),
    cancelReason: text('cancel_reason'),
    declinedAt: timestamp('declined_at', { withTimezone: true }),
    declinedBy: text('declined_by'),
    declineReason: text('decline_reason'),
  },
  (table) => ({
    mentorEmailScheduledIdx: index(
      'mentor_sessions_mentor_email_scheduled_idx'
    ).on(table.mentorEmail, table.scheduledAt),
    menteeEmailScheduledIdx: index(
      'mentor_sessions_mentee_email_scheduled_idx'
    ).on(table.menteeEmail, table.scheduledAt),
    mentorUserIdIdx: index('mentor_sessions_mentor_user_id_idx').on(
      table.mentorUserId
    ),
    menteeUserIdIdx: index('mentor_sessions_mentee_user_id_idx').on(
      table.menteeUserId
    ),
    statusIdx: index('mentor_sessions_status_idx').on(table.status),
    scheduledAtIdx: index('mentor_sessions_scheduled_at_idx').on(
      table.scheduledAt
    ),
  })
);

// =============================================================================
// Intake Forms
// =============================================================================

export const intakeForms = pgTable(
  'intake_forms',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    email: text('email').notNull().unique(),
    formType: intakeFormType('form_type').notNull(),
    name: text('name'),
    complete: boolean('complete').notNull().default(false),
    formData: jsonb('form_data').notNull(),
  },
  (table) => ({
    emailIdx: index('intake_forms_email_idx').on(table.email),
    formTypeIdx: index('intake_forms_form_type_idx').on(table.formType),
    completeIdx: index('intake_forms_complete_idx').on(table.complete),
  })
);

// =============================================================================
// Social / ActivityPub Federation
// =============================================================================

export const socialActors = pgTable(
  'social_actors',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    username: text('username').notNull(),
    domain: text('domain').notNull(),
    profileId: text('profile_id').unique(),
    uri: text('uri').notNull().unique(),
    inboxUrl: text('inbox_url').notNull(),
    outboxUrl: text('outbox_url').notNull(),
    followersUrl: text('followers_url').notNull(),
    followingUrl: text('following_url').notNull(),
    sharedInboxUrl: text('shared_inbox_url'),
    publicKey: text('public_key').notNull(),
    privateKey: text('private_key'),
    name: text('name'),
    summary: text('summary'),
    iconUrl: text('icon_url'),
    headerUrl: text('header_url'),
    followingCount: integer('following_count').notNull().default(0),
    followersCount: integer('followers_count').notNull().default(0),
    statusCount: integer('status_count').notNull().default(0),
    manuallyApprovesFollowers: boolean('manually_approves_followers')
      .notNull()
      .default(false),
  },
  (table) => ({
    usernamedomainUnique: uniqueIndex(
      'social_actors_username_domain_unique'
    ).on(table.username, table.domain),
    domainIdx: index('social_actors_domain_idx').on(table.domain),
    profileIdIdx: index('social_actors_profile_id_idx').on(table.profileId),
  })
);

export const socialStatuses = pgTable(
  'social_statuses',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    uri: text('uri').notNull().unique(),
    actorId: text('actor_id').notNull(),
    articleId: text('article_id'),
    type: text('type').notNull().default('Note'),
    content: text('content'),
    contentWarning: text('content_warning'),
    url: text('url'),
    inReplyToUri: text('in_reply_to_uri'),
    inReplyToId: text('in_reply_to_id'),
    recipientTo: jsonb('recipient_to')
      .notNull()
      .default(sql`'[]'::jsonb`),
    recipientCc: jsonb('recipient_cc')
      .notNull()
      .default(sql`'[]'::jsonb`),
    published: timestamp('published', { withTimezone: true }),
    isDraft: boolean('is_draft').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    location: jsonb('location'),
    repliesCount: integer('replies_count').notNull().default(0),
    likesCount: integer('likes_count').notNull().default(0),
    announcesCount: integer('announces_count').notNull().default(0),
    eventId: text('event_id'),
    ccLicense: ccLicense('cc_license').notNull().default('cc-by-sa-4'),
  },
  (table) => ({
    actorPublishedIdx: index('social_statuses_actor_published_idx').on(
      table.actorId,
      table.published
    ),
    articleIdIdx: index('social_statuses_article_id_idx').on(table.articleId),
    inReplyToUriIdx: index('social_statuses_in_reply_to_uri_idx').on(
      table.inReplyToUri
    ),
    inReplyToIdIdx: index('social_statuses_in_reply_to_id_idx').on(
      table.inReplyToId
    ),
    eventIdIdx: index('social_statuses_event_id_idx').on(table.eventId),
  })
);

export const articleAnnouncements = pgTable(
  'article_announcements',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    articleId: text('article_id').notNull(),
    authorId: text('author_id').notNull(),
    actorId: text('actor_id'),
    content: text('content').notNull(),
    statusId: text('status_id').unique(),
  },
  (table) => ({
    articleAuthorUnique: uniqueIndex(
      'article_announcements_article_author_unique'
    ).on(table.articleId, table.authorId),
    articleIdIdx: index('article_announcements_article_id_idx').on(
      table.articleId
    ),
    authorIdIdx: index('article_announcements_author_id_idx').on(
      table.authorId
    ),
  })
);

export const socialFollows = pgTable(
  'social_follows',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    actorId: text('actor_id').notNull(),
    targetActorId: text('target_actor_id').notNull(),
    uri: text('uri').unique(),
    status: socialFollowStatus('status').notNull().default('pending'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (table) => ({
    actorTargetUnique: uniqueIndex('social_follows_actor_target_unique').on(
      table.actorId,
      table.targetActorId
    ),
    actorIdIdx: index('social_follows_actor_id_idx').on(table.actorId),
    targetActorIdIdx: index('social_follows_target_actor_id_idx').on(
      table.targetActorId
    ),
    statusIdx: index('social_follows_status_idx').on(table.status),
  })
);

export const socialLikes = pgTable(
  'social_likes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    actorId: text('actor_id').notNull(),
    statusId: text('status_id').notNull(),
    uri: text('uri').unique(),
  },
  (table) => ({
    actorStatusUnique: uniqueIndex('social_likes_actor_status_unique').on(
      table.actorId,
      table.statusId
    ),
    actorIdIdx: index('social_likes_actor_id_idx').on(table.actorId),
    statusIdIdx: index('social_likes_status_id_idx').on(table.statusId),
  })
);

export const socialAttachments = pgTable(
  'social_attachments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    statusId: text('status_id').notNull(),
    type: text('type').notNull(),
    mediaType: text('media_type'),
    url: text('url').notNull(),
    previewUrl: text('preview_url'),
    remoteUrl: text('remote_url'),
    name: text('name'),
    description: text('description'),
    blurhash: text('blurhash'),
    width: integer('width'),
    height: integer('height'),
    peaks: jsonb('peaks'),
  },
  (table) => ({
    statusIdIdx: index('social_attachments_status_id_idx').on(table.statusId),
  })
);

export const socialTags = pgTable(
  'social_tags',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    statusId: text('status_id').notNull(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    href: text('href'),
  },
  (table) => ({
    statusIdIdx: index('social_tags_status_id_idx').on(table.statusId),
    typeNameIdx: index('social_tags_type_name_idx').on(table.type, table.name),
  })
);

// =============================================================================
// Events
// =============================================================================

export const venues = pgTable(
  'venues',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    city: text('city').notNull(),
    state: text('state').notNull(),
    country: text('country').notNull().default('US'),
    postalCode: text('postal_code'),
    lat: numeric('lat', { precision: 10, scale: 7 }),
    lng: numeric('lng', { precision: 10, scale: 7 }),
    capacity: integer('capacity'),
    parkingOptions: parkingOptions('parking_options').notNull().default('none'),
    operatorProfileId: text('operator_profile_id').notNull(),
    status: venueStatus('status').notNull().default('pending_review'),
    safetyContact: jsonb('safety_contact'),
    accessibilityNotes: text('accessibility_notes'),
    photos: jsonb('photos')
      .notNull()
      .default(sql`'[]'::jsonb`),
    website: text('website'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspendedBy: text('suspended_by'),
    suspensionReason: text('suspension_reason'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
  },
  (table) => ({
    slugIdx: index('venues_slug_idx').on(table.slug),
    operatorProfileIdIdx: index('venues_operator_profile_id_idx').on(
      table.operatorProfileId
    ),
    statusIdx: index('venues_status_idx').on(table.status),
    cityStateIdx: index('venues_city_state_idx').on(table.city, table.state),
  })
);

export const events = pgTable(
  'events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    coverImage: text('cover_image'),
    hostProfileId: text('host_profile_id').notNull(),
    venueId: text('venue_id').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    timezone: text('timezone').notNull().default('America/New_York'),
    status: eventStatus('status').notNull().default('draft'),
    visibility: eventVisibility('visibility').notNull().default('public'),
    attendeeCap: integer('attendee_cap'),
    attendeeCount: integer('attendee_count').notNull().default(0),
    ageRestriction: ageRestriction('age_restriction')
      .notNull()
      .default('all_ages'),
    photoPolicy: photoPolicy('photo_policy').notNull().default('allowed'),
    dresscode: dresscode('dresscode').notNull().default('none'),
    iCalUid: text('ical_uid').notNull().unique(),
    panamiaCoOrganizer: boolean('panamia_co_organizer').notNull().default(true),
    tosAcceptedAt: timestamp('tos_accepted_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: text('cancelled_by'),
    cancellationReason: text('cancellation_reason'),
    streamEligible: boolean('stream_eligible').notNull().default(false),
    streamStatus: streamStatus('stream_status').notNull().default('offline'),
    cfStreamId: text('cf_stream_id'),
    cfStreamPlaybackId: text('cf_stream_playback_id'),
    cfStreamSrtUrl: text('cf_stream_srt_url'),
    cfStreamSrtKey: text('cf_stream_srt_key'),
    cfStreamRecordingUrl: text('cf_stream_recording_url'),
    streamLiveAt: timestamp('stream_live_at', { withTimezone: true }),
    streamEndedAt: timestamp('stream_ended_at', { withTimezone: true }),
  },
  (table) => ({
    slugIdx: index('events_slug_idx').on(table.slug),
    hostProfileIdIdx: index('events_host_profile_id_idx').on(
      table.hostProfileId
    ),
    venueIdIdx: index('events_venue_id_idx').on(table.venueId),
    statusVisibilityIdx: index('events_status_visibility_idx').on(
      table.status,
      table.visibility
    ),
    startsAtIdx: index('events_starts_at_idx').on(table.startsAt),
    iCalUidIdx: index('events_ical_uid_idx').on(table.iCalUid),
  })
);

export const eventOrganizers = pgTable(
  'event_organizers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    eventId: text('event_id').notNull(),
    profileId: text('profile_id').notNull(),
    role: organizerRole('role').notNull(),
    canSeeRsvpList: boolean('can_see_rsvp_list').notNull().default(false),
    invitedBy: text('invited_by'),
    invitedAt: timestamp('invited_at', { withTimezone: true }).$defaultFn(
      () => new Date()
    ),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    declinedAt: timestamp('declined_at', { withTimezone: true }),
    message: text('message'),
  },
  (table) => ({
    eventProfileUnique: uniqueIndex('event_organizers_event_profile_unique').on(
      table.eventId,
      table.profileId
    ),
    eventIdIdx: index('event_organizers_event_id_idx').on(table.eventId),
    profileIdIdx: index('event_organizers_profile_id_idx').on(table.profileId),
  })
);

export const eventAttendees = pgTable(
  'event_attendees',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    eventId: text('event_id').notNull(),
    profileId: text('profile_id').notNull(),
    status: attendeeStatus('status').notNull(),
    invitedBy: text('invited_by'),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (table) => ({
    eventProfileUnique: uniqueIndex('event_attendees_event_profile_unique').on(
      table.eventId,
      table.profileId
    ),
    eventStatusIdx: index('event_attendees_event_status_idx').on(
      table.eventId,
      table.status
    ),
    profileIdIdx: index('event_attendees_profile_id_idx').on(table.profileId),
  })
);

export const eventNotes = pgTable(
  'event_notes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    eventId: text('event_id').notNull(),
    authorProfileId: text('author_profile_id').notNull(),
    content: text('content').notNull(),
    audience: text('audience').notNull().default('all'),
  },
  (table) => ({
    eventCreatedIdx: index('event_notes_event_created_idx').on(
      table.eventId,
      table.createdAt
    ),
    authorProfileIdIdx: index('event_notes_author_profile_id_idx').on(
      table.authorProfileId
    ),
  })
);

export const eventPhotos = pgTable(
  'event_photos',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    eventId: text('event_id').notNull(),
    uploaderProfileId: text('uploader_profile_id').notNull(),
    url: text('url').notNull(),
    caption: text('caption'),
    approved: boolean('approved').notNull().default(false),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    ccLicense: ccLicense('cc_license').notNull().default('cc-by-sa-4'),
  },
  (table) => ({
    eventApprovedIdx: index('event_photos_event_approved_idx').on(
      table.eventId,
      table.approved
    ),
    uploaderProfileIdIdx: index('event_photos_uploader_profile_id_idx').on(
      table.uploaderProfileId
    ),
  })
);

// =============================================================================
// Screenname History
// =============================================================================

export const screennameHistory = pgTable(
  'screenname_history',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    screenname: text('screenname').notNull().unique(),
    userId: text('user_id').notNull(),
    redirectTo: text('redirect_to'),
  },
  (table) => ({
    userIdIdx: index('screenname_history_user_id_idx').on(table.userId),
  })
);

// =============================================================================
// Relations
// =============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  notificationsSent: many(notifications, { relationName: 'notificationActor' }),
  notificationsReceived: many(notifications, {
    relationName: 'notificationTarget',
  }),
  articles: many(articles, { relationName: 'articleAuthor' }),
  articlesRemoved: many(articles, { relationName: 'articleRemovedBy' }),
  mentorSessions: many(mentorSessions, { relationName: 'mentorSessions' }),
  menteeSessions: many(mentorSessions, { relationName: 'menteeSessions' }),
  articleAnnouncements: many(articleAnnouncements),
  screennameHistory: many(screennameHistory),
  consentReceipts: many(consentReceipts),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const consentReceiptsRelations = relations(
  consentReceipts,
  ({ one }) => ({
    user: one(users, {
      fields: [consentReceipts.userId],
      references: [users.id],
    }),
  })
);

export const verificationRelations = relations(verification, () => ({}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  actorUser: one(users, {
    fields: [notifications.actor],
    references: [users.id],
    relationName: 'notificationActor',
  }),
  targetUser: one(users, {
    fields: [notifications.target],
    references: [users.id],
    relationName: 'notificationTarget',
  }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
  socialActor: one(socialActors, {
    fields: [profiles.id],
    references: [socialActors.profileId],
  }),
  venuesOperated: many(venues),
  eventsHosted: many(events),
  eventOrganizerRows: many(eventOrganizers),
  eventAttendeeRows: many(eventAttendees),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
    relationName: 'articleAuthor',
  }),
  removedByUser: one(users, {
    fields: [articles.removedBy],
    references: [users.id],
    relationName: 'articleRemovedBy',
  }),
  parentArticle: one(articles, {
    fields: [articles.inReplyTo],
    references: [articles.id],
    relationName: 'articleReplies',
  }),
  replies: many(articles, { relationName: 'articleReplies' }),
  announcements: many(articleAnnouncements),
  socialAnnouncements: many(socialStatuses),
}));

export const mentorSessionsRelations = relations(mentorSessions, ({ one }) => ({
  mentor: one(users, {
    fields: [mentorSessions.mentorUserId],
    references: [users.id],
    relationName: 'mentorSessions',
  }),
  mentee: one(users, {
    fields: [mentorSessions.menteeUserId],
    references: [users.id],
    relationName: 'menteeSessions',
  }),
}));

export const socialActorsRelations = relations(
  socialActors,
  ({ one, many }) => ({
    profile: one(profiles, {
      fields: [socialActors.profileId],
      references: [profiles.id],
    }),
    statuses: many(socialStatuses),
    outgoingFollows: many(socialFollows, { relationName: 'followActor' }),
    incomingFollows: many(socialFollows, { relationName: 'followTarget' }),
    likes: many(socialLikes),
    announcements: many(articleAnnouncements),
  })
);

export const socialStatusesRelations = relations(
  socialStatuses,
  ({ one, many }) => ({
    actor: one(socialActors, {
      fields: [socialStatuses.actorId],
      references: [socialActors.id],
    }),
    article: one(articles, {
      fields: [socialStatuses.articleId],
      references: [articles.id],
    }),
    inReplyTo: one(socialStatuses, {
      fields: [socialStatuses.inReplyToId],
      references: [socialStatuses.id],
      relationName: 'statusReplies',
    }),
    replies: many(socialStatuses, { relationName: 'statusReplies' }),
    attachments: many(socialAttachments),
    tags: many(socialTags),
    likes: many(socialLikes),
    articleAnnouncement: one(articleAnnouncements, {
      fields: [socialStatuses.id],
      references: [articleAnnouncements.statusId],
    }),
    event: one(events, {
      fields: [socialStatuses.eventId],
      references: [events.id],
    }),
  })
);

export const articleAnnouncementsRelations = relations(
  articleAnnouncements,
  ({ one }) => ({
    article: one(articles, {
      fields: [articleAnnouncements.articleId],
      references: [articles.id],
    }),
    author: one(users, {
      fields: [articleAnnouncements.authorId],
      references: [users.id],
    }),
    actor: one(socialActors, {
      fields: [articleAnnouncements.actorId],
      references: [socialActors.id],
    }),
    status: one(socialStatuses, {
      fields: [articleAnnouncements.statusId],
      references: [socialStatuses.id],
    }),
  })
);

export const socialFollowsRelations = relations(socialFollows, ({ one }) => ({
  actor: one(socialActors, {
    fields: [socialFollows.actorId],
    references: [socialActors.id],
    relationName: 'followActor',
  }),
  targetActor: one(socialActors, {
    fields: [socialFollows.targetActorId],
    references: [socialActors.id],
    relationName: 'followTarget',
  }),
}));

export const socialLikesRelations = relations(socialLikes, ({ one }) => ({
  actor: one(socialActors, {
    fields: [socialLikes.actorId],
    references: [socialActors.id],
  }),
  status: one(socialStatuses, {
    fields: [socialLikes.statusId],
    references: [socialStatuses.id],
  }),
}));

export const socialAttachmentsRelations = relations(
  socialAttachments,
  ({ one }) => ({
    status: one(socialStatuses, {
      fields: [socialAttachments.statusId],
      references: [socialStatuses.id],
    }),
  })
);

export const socialTagsRelations = relations(socialTags, ({ one }) => ({
  status: one(socialStatuses, {
    fields: [socialTags.statusId],
    references: [socialStatuses.id],
  }),
}));

export const venuesRelations = relations(venues, ({ one, many }) => ({
  operator: one(profiles, {
    fields: [venues.operatorProfileId],
    references: [profiles.id],
  }),
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  venue: one(venues, {
    fields: [events.venueId],
    references: [venues.id],
  }),
  hostProfile: one(profiles, {
    fields: [events.hostProfileId],
    references: [profiles.id],
  }),
  organizers: many(eventOrganizers),
  attendees: many(eventAttendees),
  notes: many(eventNotes),
  photos: many(eventPhotos),
  socialStatuses: many(socialStatuses),
}));

export const eventOrganizersRelations = relations(
  eventOrganizers,
  ({ one }) => ({
    event: one(events, {
      fields: [eventOrganizers.eventId],
      references: [events.id],
    }),
    profile: one(profiles, {
      fields: [eventOrganizers.profileId],
      references: [profiles.id],
    }),
  })
);

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
  event: one(events, {
    fields: [eventAttendees.eventId],
    references: [events.id],
  }),
  profile: one(profiles, {
    fields: [eventAttendees.profileId],
    references: [profiles.id],
  }),
}));

export const eventNotesRelations = relations(eventNotes, ({ one }) => ({
  event: one(events, {
    fields: [eventNotes.eventId],
    references: [events.id],
  }),
  author: one(profiles, {
    fields: [eventNotes.authorProfileId],
    references: [profiles.id],
  }),
}));

export const eventPhotosRelations = relations(eventPhotos, ({ one }) => ({
  event: one(events, {
    fields: [eventPhotos.eventId],
    references: [events.id],
  }),
  uploader: one(profiles, {
    fields: [eventPhotos.uploaderProfileId],
    references: [profiles.id],
  }),
}));

export const screennameHistoryRelations = relations(
  screennameHistory,
  ({ one }) => ({
    user: one(users, {
      fields: [screennameHistory.userId],
      references: [users.id],
    }),
  })
);

// =============================================================================
// Inferred Types
// =============================================================================

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type ConsentReceipt = typeof consentReceipts.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type NewsletterSignup = typeof newsletterSignups.$inferSelect;
export type EmailMigration = typeof emailMigrations.$inferSelect;
export type OAuthVerification = typeof oAuthVerifications.$inferSelect;
export type BrevoContact = typeof brevoContacts.$inferSelect;
export type Interaction = typeof interactions.$inferSelect;
export type MentorSession = typeof mentorSessions.$inferSelect;
export type IntakeForm = typeof intakeForms.$inferSelect;
export type SocialActor = typeof socialActors.$inferSelect;
export type SocialStatus = typeof socialStatuses.$inferSelect;
export type ArticleAnnouncement = typeof articleAnnouncements.$inferSelect;
export type SocialFollow = typeof socialFollows.$inferSelect;
export type SocialLike = typeof socialLikes.$inferSelect;
export type SocialAttachment = typeof socialAttachments.$inferSelect;
export type SocialTag = typeof socialTags.$inferSelect;
export type ScreennameHistory = typeof screennameHistory.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventOrganizer = typeof eventOrganizers.$inferSelect;
export type EventAttendee = typeof eventAttendees.$inferSelect;
export type EventNote = typeof eventNotes.$inferSelect;
export type EventPhoto = typeof eventPhotos.$inferSelect;
