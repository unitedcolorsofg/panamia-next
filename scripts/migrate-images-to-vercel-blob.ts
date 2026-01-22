#!/usr/bin/env npx tsx
/**
 * Migration Script: BunnyCDN/External Images to Vercel Blob
 *
 * Downloads profile images from external CDNs and uploads them to Vercel Blob,
 * then updates the database with new URLs.
 *
 * Prerequisites:
 *   - POSTGRES_URL or DATABASE_URL must be set
 *   - BLOB_READ_WRITE_TOKEN must be set
 *   - Old CDN images must still be accessible
 *
 * Usage:
 *   npx tsx scripts/migrate-images-to-vercel-blob.ts [--dry-run]
 *
 * Options:
 *   --dry-run  Preview changes without modifying database or uploading files
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as https from 'https';
import * as http from 'http';

// Load environment variables
import 'dotenv/config';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run');

if (!BLOB_TOKEN && !DRY_RUN) {
  console.error('Error: BLOB_READ_WRITE_TOKEN is not set');
  console.error('Set this token or run with --dry-run to preview changes');
  process.exit(1);
}

// Image fields that may contain external CDN URLs
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

/**
 * Download file from URL
 */
async function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Follow redirect
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

/**
 * Upload file to Vercel Blob
 */
async function uploadToBlob(filename: string, buffer: Buffer): Promise<string> {
  const { put } = await import('@vercel/blob');

  const blob = await put(filename, buffer, {
    access: 'public',
    addRandomSuffix: false,
    token: BLOB_TOKEN,
  });

  return blob.url;
}

/**
 * Check if URL is an external CDN URL that needs migration
 */
function isExternalCdnUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return CDN_PATTERNS.some((pattern) => url.toLowerCase().includes(pattern));
}

/**
 * Extract filename from URL or path
 */
function extractFilename(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;

  try {
    const url = new URL(urlOrPath);
    return url.pathname.replace(/^\//, '');
  } catch {
    return urlOrPath;
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('='.repeat(60));
  console.log('External CDN to Vercel Blob Migration');
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('\n*** DRY RUN MODE - No changes will be made ***\n');
  }

  const prisma = new PrismaClient();

  try {
    console.log('Connecting to database...');

    // Find profiles with external CDN images
    const profiles = await prisma.profile.findMany({
      where: {
        OR: [
          { primaryImageCdn: { contains: 'b-cdn.net' } },
          { primaryImageCdn: { contains: 'bunnycdn' } },
          { primaryImageCdn: { contains: 'cdn.' } },
        ],
      },
    });

    console.log(`Found ${profiles.length} profiles with external CDN images\n`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const profile of profiles) {
      console.log(`\nProcessing: ${profile.name} (${profile.slug})`);

      const updates: Prisma.ProfileUpdateInput = {};
      let hasUpdates = false;

      // Check primary image
      if (isExternalCdnUrl(profile.primaryImageCdn)) {
        console.log(`  primary: ${profile.primaryImageCdn}`);

        if (DRY_RUN) {
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

          if (DRY_RUN) {
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

        if (galleryHasUpdates && !DRY_RUN) {
          updates.galleryImages = galleryUpdates as Prisma.InputJsonValue;
        }
      }

      if (hasUpdates && !DRY_RUN && Object.keys(updates).length > 0) {
        await prisma.profile.update({
          where: { id: profile.id },
          data: updates,
        });
        console.log(`  -> Database updated`);
        successCount++;
      } else if (hasUpdates) {
        successCount++;
      } else {
        skippedCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total profiles found: ${profiles.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Skipped (no external CDN images): ${skippedCount}`);

    if (DRY_RUN) {
      console.log(
        '\n*** This was a dry run. Run without --dry-run to execute. ***'
      );
    }
  } finally {
    await prisma.$disconnect();
    console.log('\nDone!');
  }
}

// Run migration
migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
