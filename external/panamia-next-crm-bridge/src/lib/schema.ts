/**
 * Drizzle schema subset for the CRM worker.
 *
 * Contains only the three tables the worker needs: users, profiles, subscriptions.
 * Keep in sync with the main app's lib/schema/index.ts manually.
 * If you change column names in the main schema, update this file too.
 */

import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
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
  // Member status
  panaVerified: boolean('pana_verified').notNull().default(false),
  // Profile content (jsonb — match main schema)
  descriptions: jsonb('descriptions'),
  // Activity tracking
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
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
