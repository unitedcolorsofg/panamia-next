#!/usr/bin/env npx tsx
/**
 * Delete User Script
 *
 * Completely removes a user from both PostgreSQL (auth) and MongoDB (profile).
 * This is a destructive operation and cannot be undone.
 *
 * What gets deleted:
 * - PostgreSQL: user record (cascades to accounts and sessions)
 * - PostgreSQL: verification tokens
 * - MongoDB: profile record
 * - MongoDB: legacy users collection record (if exists)
 *
 * Usage: npx tsx scripts/delete-user.ts <email>
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { MongoClient } from 'mongodb';
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

  if (!process.env.MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable is required');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL });
  const prisma = new PrismaClient({ adapter });
  const mongoClient = new MongoClient(process.env.MONGODB_URI);

  try {
    console.log(`\n🗑️  Deleting all data for: ${USER_EMAIL}\n`);

    // PostgreSQL deletions
    console.log('--- PostgreSQL (Auth) ---');

    // Find user first
    const user = await prisma.user.findUnique({
      where: { email: USER_EMAIL },
      include: {
        accounts: true,
        sessions: true,
      },
    });

    if (user) {
      // Delete user (cascades to accounts and sessions due to schema)
      await prisma.user.delete({
        where: { email: USER_EMAIL },
      });
      console.log(`✓ users: deleted user (id: ${user.id})`);
      console.log(`✓ accounts: deleted ${user.accounts.length} account(s)`);
      console.log(`✓ sessions: deleted ${user.sessions.length} session(s)`);
    } else {
      console.log('⚠ users: user not found');
    }

    // Delete verification tokens
    const tokensResult = await prisma.verificationToken.deleteMany({
      where: { identifier: USER_EMAIL },
    });
    console.log(
      `✓ verification_tokens: deleted ${tokensResult.count} token(s)`
    );

    // MongoDB deletions
    console.log('\n--- MongoDB (Profile) ---');

    await mongoClient.connect();
    const db = mongoClient.db();

    // Delete profile
    const profilesResult = await db
      .collection('profiles')
      .deleteMany({ email: USER_EMAIL });
    console.log(
      `✓ profiles: deleted ${profilesResult.deletedCount} profile(s)`
    );

    // Delete from legacy users collection (if exists)
    const usersResult = await db
      .collection('users')
      .deleteMany({ email: USER_EMAIL });
    if (usersResult.deletedCount > 0) {
      console.log(
        `✓ users (legacy): deleted ${usersResult.deletedCount} document(s)`
      );
    }

    console.log('\n✅ User deletion complete!');
    console.log(`All data for ${USER_EMAIL} has been removed.\n`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await mongoClient.close();
    console.log('Database connections closed.');
  }
}

deleteUser();
