/**
 * Drizzle schema subset for the CRM worker.
 *
 * Contains only the tables the worker needs: users, profiles, subscriptions.
 * Keep in sync with the main app's lib/schema/index.ts manually.
 * If you change column names in the main schema, update this file too.
 *
 * Columns NOT mirrored here (not needed by the worker):
 *   - All address / location fields
 *   - socials, galleryImages, categories, counties, locations, geo, gentedepana,
 *     status, administrative, linkedProfiles, affiliate, whatsappCommunity
 *   - socialEligible / socialEligibleAt / socialIneligibleReason
 *
 * NOTE: panaVerified is stored inside the `verification` JSONB column, not as
 * a separate boolean. Access via (profile.verification as {panaVerified?: boolean}).
 * NOTE: lastLoginAt does NOT exist in the DB — use sessions table for activity.
 */

import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // GHL integration
  ghlContactId: text('ghl_contact_id'),
  ghlOptedOut: boolean('ghl_opted_out').notNull().default(false),
  // Member status — panaVerified lives inside this JSONB
  verification: jsonb('verification'),
  // Profile content
  descriptions: jsonb('descriptions'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// subscriptions
// ---------------------------------------------------------------------------

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  planId: text('plan_id'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// newsletter_signups (transient queue — rows deleted after GHL sync)
// ---------------------------------------------------------------------------

export const newsletterSignups = pgTable(
  'newsletter_signups',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name'),
    signupType: text('signup_type'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    createdAtIdx: index('newsletter_signups_created_at_idx').on(
      table.createdAt
    ),
  })
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  subscriptions: many(subscriptions),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}));
