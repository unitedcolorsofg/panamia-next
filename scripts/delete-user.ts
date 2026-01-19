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

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const USER_EMAIL = process.argv[2];

async function deleteUser() {
  if (!USER_EMAIL) {
    console.error('❌ Error: Please provide an email address');
    console.log('Usage: npx tsx scripts/delete-user.ts <email>');
    process.exit(1);
  }

  if (!process.env.POSTGRES_URL) {
    console.error('❌ Error: POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log(`\n🗑️  Deleting all data for: ${USER_EMAIL}\n`);

    // Find user first
    const user = await prisma.user.findUnique({
      where: { email: USER_EMAIL },
      include: {
        accounts: true,
        sessions: true,
        profile: true,
      },
    });

    if (!user) {
      console.log('⚠ User not found');

      // Check if there's a profile without a user
      const orphanProfile = await prisma.profile.findUnique({
        where: { email: USER_EMAIL },
      });

      if (orphanProfile) {
        await prisma.profile.delete({ where: { id: orphanProfile.id } });
        console.log(
          `✓ profiles: deleted orphan profile (id: ${orphanProfile.id})`
        );
      }

      // Delete verification tokens
      const tokensResult = await prisma.verificationToken.deleteMany({
        where: { identifier: USER_EMAIL },
      });
      if (tokensResult.count > 0) {
        console.log(
          `✓ verification_tokens: deleted ${tokensResult.count} token(s)`
        );
      }

      console.log('\n✅ Cleanup complete!\n');
      return;
    }

    // Delete profile first (if exists)
    if (user.profile) {
      await prisma.profile.delete({ where: { id: user.profile.id } });
      console.log(`✓ profiles: deleted profile (id: ${user.profile.id})`);
    }

    // Delete notifications (both sent and received - cascades via relation)
    const notificationsSent = await prisma.notification.deleteMany({
      where: { actor: user.id },
    });
    const notificationsReceived = await prisma.notification.deleteMany({
      where: { target: user.id },
    });
    console.log(
      `✓ notifications: deleted ${notificationsSent.count + notificationsReceived.count} notification(s)`
    );

    // Delete user (cascades to accounts, sessions, follows, list memberships)
    await prisma.user.delete({
      where: { email: USER_EMAIL },
    });
    console.log(`✓ users: deleted user (id: ${user.id})`);
    console.log(`✓ accounts: deleted ${user.accounts.length} account(s)`);
    console.log(`✓ sessions: deleted ${user.sessions.length} session(s)`);

    // Delete verification tokens
    const tokensResult = await prisma.verificationToken.deleteMany({
      where: { identifier: USER_EMAIL },
    });
    console.log(
      `✓ verification_tokens: deleted ${tokensResult.count} token(s)`
    );

    console.log('\n✅ User deletion complete!');
    console.log(`All data for ${USER_EMAIL} has been removed.\n`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

deleteUser();
