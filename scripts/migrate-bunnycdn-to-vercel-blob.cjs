/**
 * Migration Script: BunnyCDN to Vercel Blob
 *
 * Downloads all profile images from BunnyCDN and uploads them to Vercel Blob,
 * then updates the database with new URLs.
 *
 * Prerequisites:
 *   - MONGODB_URI must be set
 *   - BLOB_READ_WRITE_TOKEN must be set
 *   - Old BunnyCDN images must still be accessible
 *
 * Usage:
 *   node scripts/migrate-bunnycdn-to-vercel-blob.cjs [--dry-run]
 *
 * Options:
 *   --dry-run  Preview changes without modifying database or uploading files
 */

const mongoose = require('mongoose');
const https = require('https');
const http = require('http');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run');

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is not set');
  process.exit(1);
}

if (!BLOB_TOKEN && !DRY_RUN) {
  console.error('Error: BLOB_READ_WRITE_TOKEN is not set');
  console.error('Set this token or run with --dry-run to preview changes');
  process.exit(1);
}

// Image fields that may contain BunnyCDN URLs
const IMAGE_FIELDS = ['primary', 'gallery1', 'gallery2', 'gallery3'];

/**
 * Download file from URL
 */
async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        return downloadFile(response.headers.location).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Upload file to Vercel Blob
 */
async function uploadToBlob(filename, buffer) {
  // Dynamic import for ES module
  const { put } = await import('@vercel/blob');

  const blob = await put(filename, buffer, {
    access: 'public',
    addRandomSuffix: false,
    token: BLOB_TOKEN,
  });

  return blob.url;
}

/**
 * Check if URL is a BunnyCDN URL
 */
function isBunnyCdnUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('b-cdn.net') || url.includes('bunnycdn');
}

/**
 * Extract filename from URL or path
 */
function extractFilename(urlOrPath) {
  if (!urlOrPath) return null;

  // If it's a full URL, extract the path
  try {
    const url = new URL(urlOrPath);
    return url.pathname.replace(/^\//, '');
  } catch {
    // It's already a path
    return urlOrPath;
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('='.repeat(60));
  console.log('BunnyCDN to Vercel Blob Migration');
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('\n*** DRY RUN MODE - No changes will be made ***\n');
  }

  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!\n');

  // Get the profiles collection directly
  const db = mongoose.connection.db;
  const profilesCollection = db.collection('profiles');

  // Find profiles with images
  const profiles = await profilesCollection.find({
    $or: IMAGE_FIELDS.flatMap(field => [
      { [`images.${field}CDN`]: { $regex: 'b-cdn.net|bunnycdn', $options: 'i' } },
    ]),
  }).toArray();

  console.log(`Found ${profiles.length} profiles with BunnyCDN images\n`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const profile of profiles) {
    console.log(`\nProcessing: ${profile.name || profile.email} (${profile.slug})`);

    const updates = {};
    let hasUpdates = false;

    for (const field of IMAGE_FIELDS) {
      const cdnField = `${field}CDN`;
      const cdnUrl = profile.images?.[cdnField];
      const filename = profile.images?.[field];

      if (!isBunnyCdnUrl(cdnUrl)) {
        continue;
      }

      console.log(`  ${field}: ${cdnUrl}`);

      if (DRY_RUN) {
        console.log(`    -> Would migrate to Vercel Blob`);
        hasUpdates = true;
        continue;
      }

      try {
        // Download from BunnyCDN
        console.log(`    -> Downloading...`);
        const buffer = await downloadFile(cdnUrl);
        console.log(`    -> Downloaded ${buffer.length} bytes`);

        // Upload to Vercel Blob
        const blobFilename = extractFilename(filename) || `profile/${profile.slug}/${field}.jpg`;
        console.log(`    -> Uploading as ${blobFilename}...`);
        const newUrl = await uploadToBlob(blobFilename, buffer);
        console.log(`    -> Uploaded: ${newUrl}`);

        updates[`images.${cdnField}`] = newUrl;
        hasUpdates = true;
      } catch (error) {
        console.error(`    -> ERROR: ${error.message}`);
        errorCount++;
      }
    }

    if (hasUpdates && !DRY_RUN && Object.keys(updates).length > 0) {
      await profilesCollection.updateOne(
        { _id: profile._id },
        { $set: updates }
      );
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
  console.log(`Skipped (no BunnyCDN images): ${skippedCount}`);

  if (DRY_RUN) {
    console.log('\n*** This was a dry run. Run without --dry-run to execute. ***');
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

// Run migration
migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
