#!/usr/bin/env npx tsx
/**
 * Migrate Notifications from MongoDB to PostgreSQL
 *
 * This script migrates the notifications collection from MongoDB to PostgreSQL.
 * It maps MongoDB user ObjectIds to PostgreSQL user IDs (cuid format) via email.
 *
 * Prerequisites:
 * - Run auth migration first (import-auth-data.ts)
 * - Both MONGODB_URI and POSTGRES_URL must be set
 *
 * Usage: npx tsx scripts/migrate-notifications.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { MongoClient, ObjectId } from 'mongodb';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

interface MongoNotification {
  _id: ObjectId;
  type: string;
  actor: ObjectId;
  target: ObjectId;
  object?: ObjectId;
  context: string;
  actorScreenname?: string;
  actorName?: string;
  objectType?: string;
  objectTitle?: string;
  objectUrl?: string;
  message?: string;
  read: boolean;
  readAt?: Date;
  emailSent: boolean;
  emailSentAt?: Date;
  emailPreferenceKey?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoUser {
  _id: ObjectId;
  email: string;
}

async function migrateNotifications() {
  console.log('\n🔔 Migrating Notifications from MongoDB to PostgreSQL\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No data will be written\n');
  }

  if (!process.env.MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable is required');
    process.exit(1);
  }

  if (!process.env.POSTGRES_URL) {
    console.error('❌ Error: POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  const mongoClient = new MongoClient(process.env.MONGODB_URI);
  const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoClient.connect();
    const db = mongoClient.db();
    console.log('Connected to MongoDB\n');

    // Build user ID mapping: MongoDB ObjectId -> PostgreSQL cuid
    console.log('Building user ID mapping...');
    const mongoUsers = await db
      .collection<MongoUser>('users')
      .find({})
      .toArray();
    const pgUsers = await prisma.user.findMany({
      select: { id: true, email: true },
    });

    // Create email -> PostgreSQL ID map
    const emailToPgId = new Map<string, string>();
    for (const user of pgUsers) {
      emailToPgId.set(user.email.toLowerCase(), user.id);
    }

    // Create MongoDB ObjectId -> PostgreSQL ID map
    const mongoIdToPgId = new Map<string, string>();
    let mappedUsers = 0;
    let unmappedUsers = 0;

    for (const mongoUser of mongoUsers) {
      const pgId = emailToPgId.get(mongoUser.email.toLowerCase());
      if (pgId) {
        mongoIdToPgId.set(mongoUser._id.toString(), pgId);
        mappedUsers++;
      } else {
        unmappedUsers++;
      }
    }

    console.log(`  Mapped: ${mappedUsers} users`);
    if (unmappedUsers > 0) {
      console.log(`  Unmapped: ${unmappedUsers} users (no PostgreSQL account)`);
    }
    console.log('');

    // Fetch notifications from MongoDB
    console.log('Fetching notifications from MongoDB...');
    const notifications = await db
      .collection<MongoNotification>('notifications')
      .find({})
      .toArray();
    console.log(`  Found: ${notifications.length} notifications\n`);

    if (notifications.length === 0) {
      console.log('✅ No notifications to migrate\n');
      return;
    }

    // Process notifications
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const toInsert: any[] = [];

    for (const notif of notifications) {
      // Map actor and target to PostgreSQL IDs
      const actorPgId = mongoIdToPgId.get(notif.actor.toString());
      const targetPgId = mongoIdToPgId.get(notif.target.toString());

      if (!actorPgId || !targetPgId) {
        skipped++;
        continue;
      }

      // Validate enum values
      const validTypes = [
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
      ];
      const validContexts = [
        'coauthor',
        'review',
        'article',
        'mentoring',
        'mention',
        'follow',
        'system',
      ];
      const validObjectTypes = ['article', 'profile', 'session', 'comment'];

      if (!validTypes.includes(notif.type)) {
        console.log(`  Skipping: Invalid type "${notif.type}"`);
        skipped++;
        continue;
      }

      if (!validContexts.includes(notif.context)) {
        console.log(`  Skipping: Invalid context "${notif.context}"`);
        skipped++;
        continue;
      }

      const objectType =
        notif.objectType && validObjectTypes.includes(notif.objectType)
          ? notif.objectType
          : null;

      toInsert.push({
        id: notif._id.toString(), // Keep original ID for reference
        createdAt: notif.createdAt,
        updatedAt: notif.updatedAt,
        type: notif.type as any,
        actor: actorPgId,
        target: targetPgId,
        object: notif.object?.toString() || null,
        context: notif.context as any,
        actorScreenname: notif.actorScreenname || null,
        actorName: notif.actorName || null,
        objectType: objectType as any,
        objectTitle: notif.objectTitle || null,
        objectUrl: notif.objectUrl || null,
        message: notif.message || null,
        read: notif.read,
        readAt: notif.readAt || null,
        emailSent: notif.emailSent,
        emailSentAt: notif.emailSentAt || null,
        emailPreferenceKey: notif.emailPreferenceKey || null,
        expiresAt: notif.expiresAt || null,
      });

      migrated++;
    }

    console.log(`📊 Migration summary:`);
    console.log(`  To migrate: ${migrated}`);
    console.log(`  Skipped (unmapped users): ${skipped}`);
    console.log('');

    if (DRY_RUN) {
      console.log('⚠️  DRY RUN - Skipping database writes\n');
      if (toInsert.length > 0) {
        console.log('Sample notification to insert:');
        console.log(JSON.stringify(toInsert[0], null, 2));
      }
    } else if (toInsert.length > 0) {
      console.log('Inserting notifications into PostgreSQL...');

      // Insert in batches of 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);

        // Use upsert to handle re-runs (idempotent)
        for (const notif of batch) {
          try {
            await prisma.notification.upsert({
              where: { id: notif.id },
              update: notif,
              create: notif,
            });
          } catch (error) {
            console.error(`  Error inserting notification ${notif.id}:`, error);
            errors++;
          }
        }

        console.log(`  Inserted batch ${Math.ceil((i + 1) / BATCH_SIZE)}...`);
      }

      console.log('');
    }

    console.log('✅ Migration complete!');
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped: ${skipped}`);
    if (errors > 0) {
      console.log(`  Errors: ${errors}`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await mongoClient.close();
    await prisma.$disconnect();
    console.log('Database connections closed.');
  }
}

migrateNotifications();
