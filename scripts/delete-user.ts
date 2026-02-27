#!/usr/bin/env npx tsx
/**
 * Delete User Script
 *
 * Completely removes a user and their profile from PostgreSQL.
 * This is a destructive operation and cannot be undone.
 *
 * What gets deleted:
 * - User record (cascades to accounts, sessions, follows, list memberships)
 * - Profile record
 * - Verification tokens
 * - Notifications (sent and received)
 *
 * Usage: npx tsx scripts/delete-user.ts <email>
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../lib/schema';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const { users, profiles, notifications, verification } = schema;
const USER_EMAIL = process.argv[2];

async function deleteUser() {
  if (!USER_EMAIL) {
    console.error('Error: Please provide an email address');
    console.log('Usage: npx tsx scripts/delete-user.ts <email>');
    process.exit(1);
  }

  if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client, { schema });

  try {
    console.log(`\nDeleting all data for: ${USER_EMAIL}\n`);

    // Find user first
    const user = await db.query.users.findFirst({
      where: eq(users.email, USER_EMAIL),
      with: {
        accounts: true,
        sessions: true,
        profile: true,
      },
    });

    if (!user) {
      console.log('[warning] User not found');

      // Check if there's a profile without a user
      const orphanProfile = await db.query.profiles.findFirst({
        where: eq(profiles.email, USER_EMAIL),
      });

      if (orphanProfile) {
        await db.delete(profiles).where(eq(profiles.id, orphanProfile.id));
        console.log(
          `[ok] profiles: deleted orphan profile (id: ${orphanProfile.id})`
        );
      }

      // Delete verification tokens
      const deletedTokens = await db
        .delete(verification)
        .where(eq(verification.identifier, USER_EMAIL))
        .returning();
      if (deletedTokens.length > 0) {
        console.log(
          `[ok] verification_tokens: deleted ${deletedTokens.length} token(s)`
        );
      }

      console.log('\n[ok] Cleanup complete!\n');
      return;
    }

    // Delete profile first (if exists)
    if (user.profile) {
      await db.delete(profiles).where(eq(profiles.id, user.profile.id));
      console.log(`[ok] profiles: deleted profile (id: ${user.profile.id})`);
    }

    // Delete notifications (both sent and received)
    const notificationsSent = await db
      .delete(notifications)
      .where(eq(notifications.actor, user.id))
      .returning();
    const notificationsReceived = await db
      .delete(notifications)
      .where(eq(notifications.target, user.id))
      .returning();
    console.log(
      `[ok] notifications: deleted ${notificationsSent.length + notificationsReceived.length} notification(s)`
    );

    // Delete user (cascades to accounts, sessions, follows, list memberships)
    await db.delete(users).where(eq(users.email, USER_EMAIL));
    console.log(`[ok] users: deleted user (id: ${user.id})`);
    console.log(`[ok] accounts: deleted ${user.accounts.length} account(s)`);
    console.log(`[ok] sessions: deleted ${user.sessions.length} session(s)`);

    // Delete verification tokens
    const deletedTokens = await db
      .delete(verification)
      .where(eq(verification.identifier, USER_EMAIL))
      .returning();
    console.log(
      `[ok] verification_tokens: deleted ${deletedTokens.length} token(s)`
    );

    console.log('\n[ok] User deletion complete!');
    console.log(`All data for ${USER_EMAIL} has been removed.\n`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

deleteUser();
