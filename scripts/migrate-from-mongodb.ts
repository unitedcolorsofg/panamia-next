#!/usr/bin/env npx tsx
/**
 * One-Time Migration: MongoDB to PostgreSQL
 *
 * Copies all auth and profile data from MongoDB to a fresh PostgreSQL database,
 * including migration of images from external CDNs to Vercel Blob.
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
 *   --mongodb       MongoDB connection string (required for data migration)
 *   --postgres      PostgreSQL connection string (required)
 *   --dry-run       Preview what would be migrated without writing
 *   --skip-images   Skip image migration to Vercel Blob
 *   --images-only   Only migrate images (skip data migration, requires existing PostgreSQL data)
 *
 * What gets migrated:
 *   - users (nextauth_users -> users)
 *   - accounts (nextauth_accounts -> accounts)
 *   - sessions (nextauth_sessions -> sessions)
 *   - profiles (profiles -> profiles)
 *   - images (BunnyCDN/external -> Vercel Blob)
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../lib/schema';
import { eq, like, or } from 'drizzle-orm';
import * as https from 'https';
import * as http from 'http';

type DB = PostgresJsDatabase<typeof schema>;

const { users, accounts, sessions, profiles } = schema;

// Dynamically import mongodb only when needed
let MongoClient: typeof import('mongodb').MongoClient;

interface MigrationArgs {
  mongodb: string;
  postgres: string;
  dryRun: boolean;
  skipImages: boolean;
  imagesOnly: boolean;
}

function parseArgs(): MigrationArgs {
  const args = process.argv.slice(2);
  let mongodb = '';
  let postgres = '';
  let dryRun = false;
  let skipImages = false;
  let imagesOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mongodb' && args[i + 1]) {
      mongodb = args[i + 1];
      i++;
    } else if (args[i] === '--postgres' && args[i + 1]) {
      postgres = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--skip-images') {
      skipImages = true;
    } else if (args[i] === '--images-only') {
      imagesOnly = true;
    }
  }

  if (!postgres) {
    console.error(`
Usage: npx tsx scripts/migrate-from-mongodb.ts \\
  --mongodb "mongodb+srv://user:pass@cluster/db" \\
  --postgres "postgres://user:pass@host:5432/db"

Options:
  --mongodb       MongoDB connection string (required for data migration)
  --postgres      PostgreSQL connection string (required)
  --dry-run       Preview what would be migrated without writing
  --skip-images   Skip image migration to Vercel Blob
  --images-only   Only migrate images (skip data migration)
`);
    process.exit(1);
  }

  if (!imagesOnly && !mongodb) {
    console.error('Error: --mongodb is required unless using --images-only');
    process.exit(1);
  }

  return { mongodb, postgres, dryRun, skipImages, imagesOnly };
}

function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${randomPart}${randomPart2}`.substring(0, 25);
}

// =============================================================================
// Image Migration Utilities
// =============================================================================

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const CDN_PATTERNS = ['b-cdn.net', 'bunnycdn', 'cdn.'];

interface GalleryImages {
  gallery1?: string | null;
  gallery1CDN?: string | null;
  gallery2?: string | null;
  gallery2CDN?: string | null;
  gallery3?: string | null;
  gallery3CDN?: string | null;
  [key: string]: string | null | undefined;
}

async function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            return downloadFile(redirectUrl).then(resolve).catch(reject);
          }
          reject(new Error('Redirect without location header'));
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      })
      .on('error', reject);
  });
}

async function uploadToBlob(filename: string, buffer: Buffer): Promise<string> {
  const { put } = await import('@vercel/blob');

  const blob = await put(filename, buffer, {
    access: 'public',
    addRandomSuffix: false,
    token: BLOB_TOKEN,
  });

  return blob.url;
}

function isExternalCdnUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return CDN_PATTERNS.some((pattern) => url.toLowerCase().includes(pattern));
}

function extractFilename(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  try {
    const url = new URL(urlOrPath);
    return url.pathname.replace(/^\//, '');
  } catch {
    return urlOrPath;
  }
}

async function migrateImages(
  db: DB,
  dryRun: boolean
): Promise<{ success: number; errors: number }> {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE: Image Migration (External CDN -> Vercel Blob)');
  console.log('='.repeat(60));

  if (!BLOB_TOKEN && !dryRun) {
    console.log(
      '\n[warning]  BLOB_READ_WRITE_TOKEN not set - skipping image migration'
    );
    console.log('   Set this environment variable to enable image migration');
    return { success: 0, errors: 0 };
  }

  const profileRows = await db
    .select()
    .from(profiles)
    .where(
      or(
        like(profiles.primaryImageCdn, '%b-cdn.net%'),
        like(profiles.primaryImageCdn, '%bunnycdn%'),
        like(profiles.primaryImageCdn, '%cdn.%')
      )
    );

  console.log(
    `\nFound ${profileRows.length} profiles with external CDN images\n`
  );

  let successCount = 0;
  let errorCount = 0;

  for (const profile of profileRows) {
    console.log(`Processing: ${profile.name} (${profile.slug})`);

    const updates: {
      primaryImageCdn?: string;
      galleryImages?: Record<string, string | null>;
    } = {};
    let hasUpdates = false;

    // Check primary image
    if (isExternalCdnUrl(profile.primaryImageCdn)) {
      console.log(`  primary: ${profile.primaryImageCdn}`);

      if (dryRun) {
        console.log(`    -> Would migrate to Vercel Blob`);
        hasUpdates = true;
      } else {
        try {
          console.log(`    -> Downloading...`);
          const buffer = await downloadFile(profile.primaryImageCdn!);
          console.log(`    -> Downloaded ${buffer.length} bytes`);

          const blobFilename =
            extractFilename(profile.primaryImageId) ||
            `profile/${profile.slug}/primary.jpg`;
          console.log(`    -> Uploading as ${blobFilename}...`);
          const newUrl = await uploadToBlob(blobFilename, buffer);
          console.log(`    -> Uploaded: ${newUrl}`);

          updates.primaryImageCdn = newUrl;
          hasUpdates = true;
        } catch (error) {
          console.error(
            `    -> ERROR: ${error instanceof Error ? error.message : error}`
          );
          errorCount++;
        }
      }
    }

    // Check gallery images
    const gallery = profile.galleryImages as GalleryImages | null;
    if (gallery) {
      const galleryUpdates: Record<string, string | null> = { ...gallery };
      let galleryHasUpdates = false;

      for (const field of ['gallery1', 'gallery2', 'gallery3'] as const) {
        const cdnField = `${field}CDN`;
        const cdnUrl = gallery[cdnField];

        if (!isExternalCdnUrl(cdnUrl)) continue;

        console.log(`  ${field}: ${cdnUrl}`);

        if (dryRun) {
          console.log(`    -> Would migrate to Vercel Blob`);
          hasUpdates = true;
          galleryHasUpdates = true;
          continue;
        }

        try {
          console.log(`    -> Downloading...`);
          const buffer = await downloadFile(cdnUrl!);
          console.log(`    -> Downloaded ${buffer.length} bytes`);

          const blobFilename =
            extractFilename(gallery[field]) ||
            `profile/${profile.slug}/${field}.jpg`;
          console.log(`    -> Uploading as ${blobFilename}...`);
          const newUrl = await uploadToBlob(blobFilename, buffer);
          console.log(`    -> Uploaded: ${newUrl}`);

          galleryUpdates[cdnField] = newUrl;
          hasUpdates = true;
          galleryHasUpdates = true;
        } catch (error) {
          console.error(
            `    -> ERROR: ${error instanceof Error ? error.message : error}`
          );
          errorCount++;
        }
      }

      if (galleryHasUpdates && !dryRun) {
        updates.galleryImages = galleryUpdates;
      }
    }

    if (hasUpdates && !dryRun && Object.keys(updates).length > 0) {
      await db.update(profiles).set(updates).where(eq(profiles.id, profile.id));
      console.log(`  -> Database updated`);
      successCount++;
    } else if (hasUpdates) {
      successCount++;
    }
  }

  return { success: successCount, errors: errorCount };
}

// =============================================================================
// Main Migration
// =============================================================================

async function main() {
  const {
    mongodb,
    postgres: postgresUrl,
    dryRun,
    skipImages,
    imagesOnly,
  } = parseArgs();

  if (dryRun) {
    console.log('DRY RUN - No data will be written\n');
  }

  console.log('Connecting to PostgreSQL...');
  const client = postgres(postgresUrl);
  const db = drizzle(client, { schema });
  console.log('Connected to PostgreSQL\n');

  // Track statistics
  let mongoUsers: unknown[] = [];
  let mongoAccounts: unknown[] = [];
  let mongoSessions: unknown[] = [];
  let mongoProfiles: unknown[] = [];
  let imageStats = { success: 0, errors: 0 };

  try {
    // =========================================================================
    // DATA MIGRATION (skip if --images-only)
    // =========================================================================
    if (!imagesOnly) {
      // Dynamically import mongodb
      const mongodbModule = await import('mongodb');
      MongoClient = mongodbModule.MongoClient;

      console.log('Connecting to MongoDB...');
      const mongoClient = new MongoClient(mongodb);
      await mongoClient.connect();
      const mongoDb = mongoClient.db();
      console.log('Connected to MongoDB\n');

      const userIdMap = new Map<string, string>();

      try {
        // =====================================================================
        // USERS
        // =====================================================================
        console.log('Reading users...');
        mongoUsers = await mongoDb
          .collection('nextauth_users')
          .find({})
          .toArray();
        console.log(`Found ${mongoUsers.length} users\n`);

        if (!dryRun) {
          console.log('Importing users...');
          for (const user of mongoUsers as any[]) {
            const newId = generateCuid();
            userIdMap.set(user._id.toString(), newId);

            await db.insert(users).values({
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
            });
          }
          console.log(`Imported ${mongoUsers.length} users\n`);
        }

        // =====================================================================
        // ACCOUNTS
        // =====================================================================
        console.log('Reading accounts...');
        mongoAccounts = await mongoDb
          .collection('nextauth_accounts')
          .find({})
          .toArray();
        console.log(`Found ${mongoAccounts.length} accounts\n`);

        if (!dryRun) {
          console.log('Importing accounts...');
          let imported = 0;
          let skipped = 0;

          for (const account of mongoAccounts as any[]) {
            const userId = userIdMap.get(account.userId?.toString());
            if (!userId) {
              skipped++;
              continue;
            }

            await db.insert(accounts).values({
              id: generateCuid(),
              userId,
              providerId: account.provider,
              accountId: account.providerAccountId,
              refreshToken: account.refresh_token || null,
              accessToken: account.access_token || null,
              accessTokenExpiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              scope: account.scope || null,
              idToken: account.id_token || null,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            imported++;
          }
          console.log(
            `Imported ${imported} accounts, skipped ${skipped} orphaned\n`
          );
        }

        // =====================================================================
        // SESSIONS (active only)
        // =====================================================================
        console.log('Reading sessions...');
        mongoSessions = await mongoDb
          .collection('nextauth_sessions')
          .find({ expires: { $gt: new Date() } })
          .toArray();
        console.log(`Found ${mongoSessions.length} active sessions\n`);

        if (!dryRun) {
          console.log('Importing sessions...');
          let imported = 0;
          let skipped = 0;

          for (const session of mongoSessions as any[]) {
            const userId = userIdMap.get(session.userId?.toString());
            if (!userId) {
              skipped++;
              continue;
            }

            await db.insert(sessions).values({
              id: generateCuid(),
              token: session.sessionToken,
              userId,
              expiresAt: new Date(session.expires),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            imported++;
          }
          console.log(
            `Imported ${imported} sessions, skipped ${skipped} orphaned\n`
          );
        }

        // =====================================================================
        // PROFILES
        // =====================================================================
        console.log('Reading profiles...');
        mongoProfiles = await mongoDb.collection('profiles').find({}).toArray();
        console.log(`Found ${mongoProfiles.length} profiles\n`);

        if (!dryRun) {
          console.log('Importing profiles...');
          let linked = 0;

          for (const profile of mongoProfiles as any[]) {
            let userId: string | null = null;
            if (profile.email) {
              const user = await db.query.users.findFirst({
                where: eq(users.email, profile.email.toLowerCase()),
              });
              if (user) {
                userId = user.id;
                linked++;
              }
            }

            await db.insert(profiles).values({
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
            });
          }
          console.log(
            `Imported ${mongoProfiles.length} profiles (${linked} linked to users)\n`
          );
        }
      } finally {
        await mongoClient.close();
        console.log('MongoDB connection closed.\n');
      }
    }

    // =========================================================================
    // IMAGE MIGRATION
    // =========================================================================
    if (!skipImages) {
      imageStats = await migrateImages(db, dryRun);
    }

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('Migration Complete!');
    console.log('='.repeat(60));

    if (!imagesOnly) {
      console.log('\nData Migration:');
      console.log(`  Users: ${mongoUsers.length}`);
      console.log(`  Accounts: ${mongoAccounts.length}`);
      console.log(`  Sessions: ${mongoSessions.length}`);
      console.log(`  Profiles: ${mongoProfiles.length}`);
    }

    if (!skipImages) {
      console.log('\nImage Migration:');
      console.log(`  Migrated: ${imageStats.success}`);
      console.log(`  Errors: ${imageStats.errors}`);
    }

    if (dryRun) {
      console.log('\nThis was a dry run. Remove --dry-run to migrate.');
    }
  } catch (error) {
    console.error('\nError:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nPostgreSQL connection closed.');
  }
}

main();
