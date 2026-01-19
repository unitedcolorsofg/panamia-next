#!/usr/bin/env npx tsx
/**
 * One-Time Migration: MongoDB to PostgreSQL
 *
 * Copies all auth and profile data from MongoDB to a fresh PostgreSQL database.
 * Pass connection strings as command line arguments.
 *
 * To run the migration, install mongodb first:
 * npm install mongodb
 *
 * Usage:
 *   npx tsx scripts/migrate-from-mongodb.ts \
 *     --mongodb "mongodb+srv://..." \
 *     --postgres "postgres://..."
 *
 * Options:
 *   --mongodb   MongoDB connection string (required)
 *   --postgres  PostgreSQL connection string (required)
 *   --dry-run   Preview what would be migrated without writing
 *
 * What gets migrated:
 *   - users (nextauth_users -> users)
 *   - accounts (nextauth_accounts -> accounts)
 *   - sessions (nextauth_sessions -> sessions)
 *   - profiles (profiles -> profiles)
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { MongoClient } from 'mongodb';

function parseArgs(): { mongodb: string; postgres: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let mongodb = '';
  let postgres = '';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mongodb' && args[i + 1]) {
      mongodb = args[i + 1];
      i++;
    } else if (args[i] === '--postgres' && args[i + 1]) {
      postgres = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  if (!mongodb || !postgres) {
    console.error(`
Usage: npx tsx scripts/migrate-from-mongodb.ts \\
  --mongodb "mongodb+srv://user:pass@cluster/db" \\
  --postgres "postgres://user:pass@host:5432/db"

Options:
  --mongodb   MongoDB connection string (required)
  --postgres  PostgreSQL connection string (required)
  --dry-run   Preview what would be migrated without writing
`);
    process.exit(1);
  }

  return { mongodb, postgres, dryRun };
}

function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${randomPart}${randomPart2}`.substring(0, 25);
}

async function main() {
  const { mongodb, postgres, dryRun } = parseArgs();

  if (dryRun) {
    console.log('DRY RUN - No data will be written\n');
  }

  console.log('Connecting to MongoDB...');
  const mongoClient = new MongoClient(mongodb);
  await mongoClient.connect();
  const db = mongoClient.db();
  console.log('Connected to MongoDB\n');

  console.log('Connecting to PostgreSQL...');
  const adapter = new PrismaPg({ connectionString: postgres });
  const prisma = new PrismaClient({ adapter });
  console.log('Connected to PostgreSQL\n');

  // Map MongoDB ObjectIds to new cuid IDs
  const userIdMap = new Map<string, string>();

  try {
    // =========================================================================
    // USERS
    // =========================================================================
    console.log('Reading users...');
    const mongoUsers = await db.collection('nextauth_users').find({}).toArray();
    console.log(`Found ${mongoUsers.length} users\n`);

    if (!dryRun) {
      console.log('Importing users...');
      for (const user of mongoUsers) {
        const newId = generateCuid();
        userIdMap.set(user._id.toString(), newId);

        await prisma.user.create({
          data: {
            id: newId,
            email: user.email,
            emailVerified: user.emailVerified
              ? new Date(user.emailVerified)
              : null,
            name: user.name || null,
            screenname: user.screenname || null,
            role: user.role || 'user',
            createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
            updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Imported ${mongoUsers.length} users\n`);
    }

    // =========================================================================
    // ACCOUNTS
    // =========================================================================
    console.log('Reading accounts...');
    const mongoAccounts = await db
      .collection('nextauth_accounts')
      .find({})
      .toArray();
    console.log(`Found ${mongoAccounts.length} accounts\n`);

    if (!dryRun) {
      console.log('Importing accounts...');
      let imported = 0;
      let skipped = 0;

      for (const account of mongoAccounts) {
        const userId = userIdMap.get(account.userId?.toString());
        if (!userId) {
          skipped++;
          continue;
        }

        await prisma.account.create({
          data: {
            id: generateCuid(),
            userId,
            type: account.type || 'oauth',
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token || null,
            access_token: account.access_token || null,
            expires_at: account.expires_at || null,
            token_type: account.token_type || null,
            scope: account.scope || null,
            id_token: account.id_token || null,
            session_state: account.session_state || null,
          },
        });
        imported++;
      }
      console.log(
        `Imported ${imported} accounts, skipped ${skipped} orphaned\n`
      );
    }

    // =========================================================================
    // SESSIONS (active only)
    // =========================================================================
    console.log('Reading sessions...');
    const mongoSessions = await db
      .collection('nextauth_sessions')
      .find({ expires: { $gt: new Date() } })
      .toArray();
    console.log(`Found ${mongoSessions.length} active sessions\n`);

    if (!dryRun) {
      console.log('Importing sessions...');
      let imported = 0;
      let skipped = 0;

      for (const session of mongoSessions) {
        const userId = userIdMap.get(session.userId?.toString());
        if (!userId) {
          skipped++;
          continue;
        }

        await prisma.session.create({
          data: {
            id: generateCuid(),
            sessionToken: session.sessionToken,
            userId,
            expires: new Date(session.expires),
          },
        });
        imported++;
      }
      console.log(
        `Imported ${imported} sessions, skipped ${skipped} orphaned\n`
      );
    }

    // =========================================================================
    // PROFILES
    // =========================================================================
    console.log('Reading profiles...');
    const mongoProfiles = await db.collection('profiles').find({}).toArray();
    console.log(`Found ${mongoProfiles.length} profiles\n`);

    if (!dryRun) {
      console.log('Importing profiles...');
      let linked = 0;

      for (const profile of mongoProfiles) {
        // Link to user by email if possible
        let userId: string | null = null;
        if (profile.email) {
          const user = await prisma.user.findUnique({
            where: { email: profile.email.toLowerCase() },
          });
          if (user) {
            userId = user.id;
            linked++;
          }
        }

        await prisma.profile.create({
          data: {
            id: generateCuid(),
            userId,
            email:
              profile.email?.toLowerCase() ||
              `unknown-${generateCuid()}@placeholder.local`,
            name: profile.name || 'Unknown',
            slug: profile.slug || null,
            phoneNumber: profile.phoneNumber || null,
            pronouns: profile.pronouns || null,
            primaryImageId: profile.images?.primaryId || null,
            primaryImageCdn: profile.images?.primaryCDN || null,
            addressName: profile.primary_address?.name || null,
            addressLine1: profile.primary_address?.line1 || null,
            addressLine2: profile.primary_address?.line2 || null,
            addressLocality: profile.primary_address?.city || null,
            addressRegion: profile.primary_address?.state || null,
            addressPostalCode: profile.primary_address?.zipCode || null,
            addressCountry: profile.primary_address?.country || 'US',
            active: profile.active ?? false,
            locallyBased: profile.locally_based || null,
            descriptions:
              profile.five_words || profile.details || profile.background
                ? {
                    fiveWords: profile.five_words || null,
                    details: profile.details || null,
                    background: profile.background || null,
                    tags: profile.tags || null,
                  }
                : undefined,
            socials: profile.socialLinks || profile.socials || undefined,
            galleryImages: profile.images?.gallery1CDN
              ? {
                  gallery1: profile.images?.gallery1 || null,
                  gallery1CDN: profile.images?.gallery1CDN || null,
                  gallery2: profile.images?.gallery2 || null,
                  gallery2CDN: profile.images?.gallery2CDN || null,
                  gallery3: profile.images?.gallery3 || null,
                  gallery3CDN: profile.images?.gallery3CDN || null,
                }
              : undefined,
            categories: profile.categories || undefined,
            counties: profile.counties || undefined,
            geo: profile.geo || undefined,
            mentoring: profile.mentoring || undefined,
            availability: profile.availability || undefined,
            verification: profile.verification || undefined,
            roles: profile.roles || undefined,
            gentedepana: profile.gentedepana || undefined,
            createdAt: profile.createdAt
              ? new Date(profile.createdAt)
              : new Date(),
            updatedAt: profile.updatedAt
              ? new Date(profile.updatedAt)
              : new Date(),
          },
        });
      }
      console.log(
        `Imported ${mongoProfiles.length} profiles (${linked} linked to users)\n`
      );
    }

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('Migration complete!\n');
    console.log('Summary:');
    console.log(`  Users: ${mongoUsers.length}`);
    console.log(`  Accounts: ${mongoAccounts.length}`);
    console.log(`  Sessions: ${mongoSessions.length}`);
    console.log(`  Profiles: ${mongoProfiles.length}`);

    if (dryRun) {
      console.log('\nThis was a dry run. Remove --dry-run to migrate.');
    }
  } catch (error) {
    console.error('\nError:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await mongoClient.close();
    console.log('\nConnections closed.');
  }
}

main();
