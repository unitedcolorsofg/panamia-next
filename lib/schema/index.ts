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
  type AnyPgColumn,
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

export const ccLicense = pgEnum('cc_license', [
  'cc-by-4',
  'cc-by-sa-4',
  'cc-0',
]);

export const articleType = pgEnum('article_type', [
  'business_update',
  'community_commentary',
  'staff_update',
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

// 'unlisted' = excluded from the /e listing and never crossposted to Nostr, but
// still viewable by direct URL (secret link). It is NOT access-controlled —
// true invitation-only private events (followers/invite/private) are a future
// phase, intentionally dropped in the Nostr merge; see docs/EVENTS-ROADMAP.md.
export const eventVisibility = pgEnum('event_visibility', [
  'public',
  'unlisted',
]);

// online / offline / hybrid — maps 1:1 to nostrlab's NIP-52 `mode` tag, lower
// case on the wire (see lib/event.ts crosspost mapping).
export const eventMode = pgEnum('event_mode', ['online', 'offline', 'hybrid']);

export const rsvpStatus = pgEnum('rsvp_status', [
  'going',
  'maybe',
  'not_going',
]);

export const venueStatus = pgEnum('venue_status', [
  'pending_review',
  'active',
  'suspended',
]);

export const parkingOptions = pgEnum('parking_options', [
  'none',
  'street',
  'lot',
  'garage',
  'valet',
  'limited_garage',
  'good_luck',
]);

export const venueType = pgEnum('venue_type', [
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
  'other',
]);

export const venueEnvironment = pgEnum('venue_environment', [
  'indoor',
  'outdoor',
  'mixed',
]);

export const venueUsage = pgEnum('venue_usage', [
  'single_purpose',
  'mixed_use',
]);

export const adaAccessibility = pgEnum('ada_accessibility', [
  'yes',
  'partial',
  'none',
  'unknown',
]);

export const rentalModel = pgEnum('rental_model', [
  'free',
  'hourly',
  'flat',
  'tickets',
  'request_quote',
  'revenue_share',
  'other',
]);

export const venueOwnership = pgEnum('venue_ownership', [
  'private',
  'public',
  'nonprofit',
  'unknown',
]);

// Moderator workflow state for forwarded NIP-56 abuse reports.
// 'removed' is terminal/non-revocable: the reported content + report event have
// been hard-deleted from the relay, so there is nothing to reopen.
export const relayReportStatus = pgEnum('relay_report_status', [
  'open',
  'actioned',
  'dismissed',
  'removed',
]);

// Provenance of a profile's nostr_pubkey: 'issued' = generated client-side
// via the /r flow; 'byo' = uploaded by the user after acknowledging the
// cross-relay correlation disclosure. See docs/RESILIENCE-ROADMAP.md.
export const nostrPubkeySource = pgEnum('nostr_pubkey_source', [
  'issued',
  'byo',
]);

// NOTE: Cloudflare-backed live-streaming (stream_status enum + events.cf_stream_*
// columns) was intentionally dropped in the Nostr event-model merge. Placeholder
// only — reintroduce here alongside the events table fields when streaming lands.

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
export type EventMode = (typeof eventMode.enumValues)[number];
export type RsvpStatus = (typeof rsvpStatus.enumValues)[number];
export type VenueStatus = (typeof venueStatus.enumValues)[number];
export type ParkingOptions = (typeof parkingOptions.enumValues)[number];
export type RelayReportStatus = (typeof relayReportStatus.enumValues)[number];
export type NostrPubkeySource = (typeof nostrPubkeySource.enumValues)[number];
export type VenueType = (typeof venueType.enumValues)[number];
export type VenueEnvironment = (typeof venueEnvironment.enumValues)[number];
export type VenueUsage = (typeof venueUsage.enumValues)[number];
export type AdaAccessibility = (typeof adaAccessibility.enumValues)[number];
export type RentalModel = (typeof rentalModel.enumValues)[number];
export type VenueOwnership = (typeof venueOwnership.enumValues)[number];

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
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
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
    // No FK to users: consent receipts are a compliance_record and must
    // outlive the account (proof consent existed). A cascade FK would delete
    // them with the user. Kept as a bare id, like deletion_logs.user_id.
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
    // actor/target/object are polymorphic — target can be a user, article,
    // event, etc., so no FK constraints. Denormalized actor_* and object_*
    // columns below carry display data so stale references don't break the UI.
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
    // Nullable: profiles can be unclaimed (created before a user attaches via
    // auto-claim) or tombstoned (userId nulled on account deletion to keep the
    // profile for attribution while severing the cascade FK). Postgres treats
    // NULLs as distinct, so the unique constraint still allows many such rows.
    userId: text('user_id')
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    // Default Creative Commons license applied when this user composes new
    // Articles (/a) and social timeline posts (/s). Overridable per item.
    defaultCcLicense: ccLicense('default_cc_license')
      .notNull()
      .default('cc-by-4'),
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
    // Stripe
    stripeCustomerId: text('stripe_customer_id'),
    // Nostr identity — hex secp256k1 x-only pubkey (64 chars), unique across
    // all profiles. Nullable: keys are issued/BYO opt-in via the /r flow.
    nostrPubkey: text('nostr_pubkey').unique(),
    nostrPubkeySource: nostrPubkeySource('nostr_pubkey_source'),
  },
  (table) => ({
    activeIdx: index('profiles_active_idx').on(table.active),
    nostrPubkeyIdx: index('profiles_nostr_pubkey_idx').on(table.nostrPubkey),
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
    coverImageAlt: text('cover_image_alt'),
    articleType: articleType('article_type').notNull(),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    authorId: text('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    coAuthors: jsonb('co_authors')
      .notNull()
      .default(sql`'[]'::jsonb`),
    reviewedBy: jsonb('reviewed_by'),
    inReplyTo: text('in_reply_to').references((): AnyPgColumn => articles.id, {
      onDelete: 'set null',
    }),
    status: articleStatus('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    deletionReason: text('deletion_reason'),
    readingTime: integer('reading_time').notNull().default(1),
    mastodonPostUrl: text('mastodon_post_url'),
    ccLicense: ccLicense('cc_license').notNull().default('cc-by-4'),
    // Set only when the home relay accepted the NIP-23 kind-30023 mirror.
    nostrEventId: text('nostr_event_id'),
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
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    oldEmail: text('old_email').notNull(),
    newEmail: text('new_email').notNull(),
    migrationToken: text('migration_token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    userIdIdx: index('email_migrations_user_id_idx').on(table.userId),
    newEmailIdx: index('email_migrations_new_email_idx').on(table.newEmail),
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
    // userId is the preferred join key going forward (email can change).
    // Nullable during transition — backfill from email then make notNull.
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    action: text('action'),
    affiliate: text('affiliate'),
    points: integer('points'),
    metadata: jsonb('metadata'),
  },
  (table) => ({
    emailIdx: index('interactions_email_idx').on(table.email),
    userIdIdx: index('interactions_user_id_idx').on(table.userId),
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
    mentorUserId: text('mentor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    menteeUserId: text('mentee_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
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
    profileId: text('profile_id')
      .unique()
      .references(() => profiles.id, { onDelete: 'set null' }),
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
    actorId: text('actor_id')
      .notNull()
      .references(() => socialActors.id, { onDelete: 'cascade' }),
    articleId: text('article_id').references(() => articles.id, {
      onDelete: 'cascade',
    }),
    type: text('type').notNull().default('Note'),
    content: text('content'),
    contentWarning: text('content_warning'),
    url: text('url'),
    inReplyToUri: text('in_reply_to_uri'),
    inReplyToId: text('in_reply_to_id').references(
      (): AnyPgColumn => socialStatuses.id,
      {
        onDelete: 'set null',
      }
    ),
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
    eventId: text('event_id').references((): AnyPgColumn => events.id, {
      onDelete: 'set null',
    }),
    ccLicense: ccLicense('cc_license').notNull().default('cc-by-4'),
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
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').references(() => socialActors.id, {
      onDelete: 'set null',
    }),
    content: text('content').notNull(),
    statusId: text('status_id')
      .unique()
      .references(() => socialStatuses.id, { onDelete: 'set null' }),
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
    actorId: text('actor_id')
      .notNull()
      .references(() => socialActors.id, { onDelete: 'cascade' }),
    targetActorId: text('target_actor_id')
      .notNull()
      .references(() => socialActors.id, { onDelete: 'cascade' }),
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
    actorId: text('actor_id')
      .notNull()
      .references(() => socialActors.id, { onDelete: 'cascade' }),
    statusId: text('status_id')
      .notNull()
      .references(() => socialStatuses.id, { onDelete: 'cascade' }),
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
    statusId: text('status_id')
      .notNull()
      .references(() => socialStatuses.id, { onDelete: 'cascade' }),
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
    statusId: text('status_id')
      .notNull()
      .references(() => socialStatuses.id, { onDelete: 'cascade' }),
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
    fireCapacity: integer('fire_capacity').notNull(),
    parcelControlNumber: text('parcel_control_number'),
    parcelUnit: text('parcel_unit'),
    venueType: venueType('venue_type'),
    venueEnvironment: venueEnvironment('venue_environment'),
    venueUsage: venueUsage('venue_usage'),
    venueOwnership: venueOwnership('venue_ownership')
      .notNull()
      .default('unknown'),
    adaAccessibility: adaAccessibility('ada_accessibility')
      .notNull()
      .default('unknown'),
    parkingOptions: parkingOptions('parking_options').notNull().default('none'),
    parkingInstructions: text('parking_instructions'),
    hasLiquorLicense: boolean('has_liquor_license').notNull().default(false),
    houseRules: text('house_rules'),
    ownerContact: jsonb('owner_contact'),
    avInfrastructure: jsonb('av_infrastructure')
      .notNull()
      .default(sql`'[]'::jsonb`),
    safety: jsonb('safety'),
    buildingPlansUrl: text('building_plans_url'),
    supportingDocsUrls: jsonb('supporting_docs_urls')
      .notNull()
      .default(sql`'[]'::jsonb`),
    isFree: boolean('is_free').notNull().default(false),
    rentalModel: rentalModel('rental_model'),
    rentalPricing: jsonb('rental_pricing'),
    bookingInstructions: text('booking_instructions'),
    insuranceCoiUrl: text('insurance_coi_url'),
    insuranceCoiExpiresAt: timestamp('insurance_coi_expires_at', {
      withTimezone: true,
    }),
    insuranceNotes: text('insurance_notes'),
    operatorProfileId: text('operator_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    status: venueStatus('status').notNull().default('pending_review'),
    safetyContact: jsonb('safety_contact'),
    accessibilityNotes: text('accessibility_notes'),
    photos: jsonb('photos')
      .notNull()
      .default(sql`'[]'::jsonb`),
    website: text('website'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspendedBy: text('suspended_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    suspensionReason: text('suspension_reason'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    operatorProfileIdIdx: index('venues_operator_profile_id_idx').on(
      table.operatorProfileId
    ),
    statusIdx: index('venues_status_idx').on(table.status),
    cityStateIdx: index('venues_city_state_idx').on(table.city, table.state),
    venueTypeIdx: index('venues_type_idx').on(table.venueType),
    venueIsFreeIdx: index('venues_is_free_idx').on(table.isFree),
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
    coverImageAlt: text('cover_image_alt'),
    hostProfileId: text('host_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    // Nullable: online-only events have no physical venue.
    venueId: text('venue_id').references(() => venues.id, {
      onDelete: 'restrict',
    }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    timezone: text('timezone').notNull().default('America/New_York'),
    status: eventStatus('status').notNull().default('draft'),
    visibility: eventVisibility('visibility').notNull().default('public'),
    mode: eventMode('mode').notNull().default('offline'),
    attendeeCap: integer('attendee_cap'),
    // Only verified, 'going' RSVPs count. Maintained transactionally by the
    // rsvp routes; the hard cap is min(attendeeCap, venue.fireCapacity).
    attendeeCount: integer('attendee_count').notNull().default(0),
    icalUid: text('ical_uid').notNull().unique(),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    // Set only when the home relay accepted the kind-31923 mirror.
    nostrEventId: text('nostr_event_id'),
    // ---------------------------------------------------------------------
    // Deferred (placeholder) — dropped in the Nostr event-model merge, see
    // docs/EVENTS-ROADMAP.md v2 backlog: age_restriction, photo_policy,
    // dresscode, panamia_co_organizer, tos_accepted_at, cancellation fields,
    // and Cloudflare live-streaming (stream_status, cf_stream_*). Reintroduce
    // as a follow-up migration when those features land.
    // ---------------------------------------------------------------------
  },
  (table) => ({
    hostProfileIdIdx: index('events_host_profile_id_idx').on(
      table.hostProfileId
    ),
    venueIdIdx: index('events_venue_id_idx').on(table.venueId),
    statusVisibilityIdx: index('events_status_visibility_idx').on(
      table.status,
      table.visibility
    ),
    startsAtIdx: index('events_starts_at_idx').on(table.startsAt),
  })
);

// One row per (event, attendee). Attendees need NO Nostr key and NO account:
// anonymous RSVPs are name+email, verified via a magic link backed by the
// existing verification_tokens table. Logged-in users get profileId set and
// emailVerifiedAt stamped immediately (auth already verified their email).
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
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    // Set for logged-in attendees; null for anonymous email RSVPs.
    profileId: text('profile_id').references(() => profiles.id, {
      onDelete: 'cascade',
    }),
    // Nullable: RSVPs that arrive from Nostr (kind 31925) have no email — they
    // are keyed by nostrPubkey instead. Web RSVPs always set email.
    email: text('email'),
    name: text('name').notNull(),
    status: rsvpStatus('status').notNull(),
    // Null until confirmed. Web: stamped on magic-link click (or immediately
    // for logged-in users). Nostr: stamped on ingest — the event signature IS
    // the verification. Only non-null + status 'going' counts toward capacity.
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    // Inbound two-way sync (phase 2). The signer pubkey of a kind-31925 RSVP
    // ingested from Nostr; identifies the attendee when there's no profile.
    nostrPubkey: text('nostr_pubkey'),
    // created_at of the last kind-31925 we applied — guards against applying a
    // stale RSVP when events arrive out of order (Nostr is replaceable, latest
    // wins). See app/api/internal/relay/rsvp.
    nostrRsvpAt: timestamp('nostr_rsvp_at', { withTimezone: true }),
    // The kind-31925 event id we last ingested (inbound), or — once RSVP→Nostr
    // outbound lands — the id we published. See docs/EVENTS-ROADMAP.md.
    nostrEventId: text('nostr_event_id'),
  },
  (table) => ({
    eventEmailUnique: uniqueIndex('event_attendees_event_email_unique').on(
      table.eventId,
      table.email
    ),
    eventProfileUnique: uniqueIndex('event_attendees_event_profile_unique').on(
      table.eventId,
      table.profileId
    ),
    eventNostrPubkeyUnique: uniqueIndex(
      'event_attendees_event_nostr_pubkey_unique'
    ).on(table.eventId, table.nostrPubkey),
    eventStatusIdx: index('event_attendees_event_status_idx').on(
      table.eventId,
      table.status
    ),
    profileIdIdx: index('event_attendees_profile_id_idx').on(table.profileId),
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
    // No FK to users: screenname history is a compliance_record kept for
    // federation 410-Gone continuity, so it must survive account deletion.
    // A cascade FK (the previous definition) silently wiped it on delete,
    // contradicting that intent. Kept as a bare id, like deletion_logs.user_id.
    userId: text('user_id').notNull(),
    redirectTo: text('redirect_to'),
  },
  (table) => ({
    userIdIdx: index('screenname_history_user_id_idx').on(table.userId),
  })
);

// =============================================================================
// Deletion Logs
// =============================================================================

export const deletionLogs = pgTable('deletion_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  screenname: text('screenname'),
  attributionChoice: text('attribution_choice').notNull(), // 'keep' | 'anonymize'
  archivedContentIds: jsonb('archived_content_ids'), // IDs of content preserved post-archive
  deletedTables: jsonb('deleted_tables'), // map of table name → count of deleted rows
  thirdPartyResults: jsonb('third_party_results'), // map of service → success boolean
  ip: text('ip'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
});

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
  articlesDeleted: many(articles, { relationName: 'articleDeletedBy' }),
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
  eventAttendeeRows: many(eventAttendees),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
    relationName: 'articleAuthor',
  }),
  deletedByUser: one(users, {
    fields: [articles.deletedBy],
    references: [users.id],
    relationName: 'articleDeletedBy',
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
  host: one(profiles, {
    fields: [events.hostProfileId],
    references: [profiles.id],
  }),
  attendees: many(eventAttendees),
  socialStatuses: many(socialStatuses),
}));

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

export const screennameHistoryRelations = relations(
  screennameHistory,
  ({ one }) => ({
    user: one(users, {
      fields: [screennameHistory.userId],
      references: [users.id],
    }),
  })
);

export const deletionLogsRelations = relations(deletionLogs, () => ({}));

// =============================================================================
// Relay Groups (NIP-29) — panamia is sole source of truth. Read by the relay
// Worker's /api/internal/relay/* endpoints. See docs/RESILIENCE-ROADMAP.md.
// =============================================================================

export const relayGroups = pgTable(
  'relay_groups',
  {
    // NIP-29 group_id — relay-chosen string, used as the "h" tag on group
    // events. Stable for the life of the group; not a UUID.
    groupId: text('group_id').primaryKey(),
    name: text('name').notNull(),
    about: text('about'),
    picture: text('picture'),
    // Discoverable groups have their kind 39000 metadata emitted publicly.
    discoverable: boolean('discoverable').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    discoverableIdx: index('relay_groups_discoverable_idx').on(
      table.discoverable
    ),
  })
);

export const relayGroupMembers = pgTable(
  'relay_group_members',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => relayGroups.groupId, { onDelete: 'cascade' }),
    // Hex-encoded secp256k1 x-only pubkey. No FK to profiles yet — the
    // nostr_pubkey linkage is deferred (BYO + issuance flow TBD).
    pubkey: text('pubkey').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pk: uniqueIndex('relay_group_members_pk').on(table.groupId, table.pubkey),
    pubkeyIdx: index('relay_group_members_pubkey_idx').on(table.pubkey),
  })
);

// Leaves in the 24h debounce grace period (kind 9022 advisory). Maturation is
// mature-on-read via lib/relay/group-maturation.ts, not cron-driven.
export const relayGroupLeavePending = pgTable(
  'relay_group_leave_pending',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => relayGroups.groupId, { onDelete: 'cascade' }),
    pubkey: text('pubkey').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pk: uniqueIndex('relay_group_leave_pending_pk').on(
      table.groupId,
      table.pubkey
    ),
    requestedAtIdx: index('relay_group_leave_pending_requested_at_idx').on(
      table.requestedAt
    ),
  })
);

// Joins awaiting admin approval (kind 9021 advisory). Row stays until an admin
// approves (insert into relay_group_members + delete here) or denies (delete).
export const relayGroupJoinPending = pgTable(
  'relay_group_join_pending',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => relayGroups.groupId, { onDelete: 'cascade' }),
    pubkey: text('pubkey').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pk: uniqueIndex('relay_group_join_pending_pk').on(
      table.groupId,
      table.pubkey
    ),
    requestedAtIdx: index('relay_group_join_pending_requested_at_idx').on(
      table.requestedAt
    ),
  })
);

// NIP-56 abuse reports (kind 1984) forwarded from the relay. Accepted from
// anyone — member or not — so no FK from reporter/target pubkeys to profiles.
// report_type is plain text (not an enum): the NIP-56 type set drifts.
export const relayReports = pgTable(
  'relay_reports',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    // The kind 1984 event id on the relay.
    eventId: text('event_id').notNull(),
    // Hex x-only pubkey of the reporter (event.pubkey).
    reporterPubkey: text('reporter_pubkey').notNull(),
    // Reported account (NIP-56 `p` tag) — nullable.
    targetPubkey: text('target_pubkey'),
    // Reported event (NIP-56 `e` tag) — nullable.
    targetEventId: text('target_event_id'),
    reportType: text('report_type'),
    content: text('content').notNull().default(''),
    // Snapshot of the reported event captured by the relay at forward time.
    reportedContent: text('reported_content'),
    reportedKind: integer('reported_kind'),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    status: relayReportStatus('status').notNull().default('open'),
    moderationReason: text('moderation_reason'),
    lastModerationActionAt: timestamp('last_moderation_action_at', {
      withTimezone: true,
    }),
  },
  (table) => ({
    // Dedup for queue readability (NOT an abuse control): collapse repeat
    // reports of the same target+type by the same reporter.
    dedupIdx: uniqueIndex('relay_reports_dedup_idx').on(
      table.reporterPubkey,
      table.targetPubkey,
      table.targetEventId,
      table.reportType
    ),
    statusIdx: index('relay_reports_status_idx').on(table.status),
    receivedAtIdx: index('relay_reports_received_at_idx').on(table.receivedAt),
  })
);

export const relayGroupsRelations = relations(relayGroups, ({ many }) => ({
  members: many(relayGroupMembers),
  leavePending: many(relayGroupLeavePending),
  joinPending: many(relayGroupJoinPending),
}));

export const relayGroupMembersRelations = relations(
  relayGroupMembers,
  ({ one }) => ({
    group: one(relayGroups, {
      fields: [relayGroupMembers.groupId],
      references: [relayGroups.groupId],
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
export type EventAttendee = typeof eventAttendees.$inferSelect;
export type DeletionLog = typeof deletionLogs.$inferSelect;
export type RelayGroup = typeof relayGroups.$inferSelect;
export type RelayGroupMember = typeof relayGroupMembers.$inferSelect;
export type RelayGroupLeavePending = typeof relayGroupLeavePending.$inferSelect;
export type RelayGroupJoinPending = typeof relayGroupJoinPending.$inferSelect;
export type RelayReport = typeof relayReports.$inferSelect;
