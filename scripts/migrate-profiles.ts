#!/usr/bin/env npx tsx
/**
 * Migrate Profiles from MongoDB to PostgreSQL
 *
 * This script migrates the profiles collection from MongoDB to PostgreSQL.
 * It maps MongoDB user ObjectIds to PostgreSQL user IDs (cuid format) via email.
 *
 * Prerequisites:
 * - Run auth migration first (import-auth-data.ts)
 * - Both MONGODB_URI and POSTGRES_URL must be set
 *
 * Schema transformations:
 * - Core data → columns (name, phone, pronouns, image, address, membership)
 * - Flexible data → JSONB (descriptions, socials, categories, etc.)
 * - Address → international format (line1/line2/locality/region/postalCode/country)
 * - Pronouns → string format ("she/her", "he/him", etc.)
 *
 * Usage: npx tsx scripts/migrate-profiles.ts [--dry-run]
 */

import { PrismaClient, MembershipLevel } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { MongoClient, ObjectId } from 'mongodb';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

// MongoDB profile structure (current)
interface MongoPronouns {
  sheher?: boolean;
  hehim?: boolean;
  theythem?: boolean;
  none?: boolean;
  other?: boolean;
  other_desc?: string;
}

interface MongoAddress {
  name?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  hours?: string;
  lat?: string;
  lng?: string;
  google_place_id?: string;
}

interface MongoImages {
  primary?: string;
  primaryCDN?: string;
  gallery1?: string;
  gallery1CDN?: string;
  gallery2?: string;
  gallery2CDN?: string;
  gallery3?: string;
  gallery3CDN?: string;
}

interface MongoProfile {
  _id: ObjectId;
  userId?: string;
  email: string;
  name: string;
  slug?: string;
  active?: boolean;
  status?: any;
  administrative?: any;
  locally_based?: string;
  details?: string;
  background?: string;
  five_words?: string;
  socials?: any;
  phone_number?: string;
  whatsapp_community?: boolean;
  pronouns?: MongoPronouns;
  tags?: string;
  hearaboutus?: string;
  affiliate?: string;
  counties?: any;
  categories?: any;
  primary_address?: MongoAddress;
  gentedepana?: any;
  geo?: any;
  locations?: any[];
  images?: MongoImages;
  linked_profiles?: any[];
  mentoring?: any;
  availability?: any;
  pusherChannelId?: string;
  verification?: any;
  roles?: any;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoUser {
  _id: ObjectId;
  email: string;
}

/**
 * Convert MongoDB pronouns object to string format
 */
function pronounsToString(pronouns?: MongoPronouns): string | null {
  if (!pronouns) return null;

  if (pronouns.sheher) return 'she/her';
  if (pronouns.hehim) return 'he/him';
  if (pronouns.theythem) return 'they/them';
  if (pronouns.none) return 'prefer not to say';
  if (pronouns.other && pronouns.other_desc) return pronouns.other_desc;
  if (pronouns.other) return 'other';

  return null;
}

/**
 * Convert MongoDB address to international format
 * US addresses: street1 → line1, city → locality, state → region, zipcode → postalCode
 */
function addressToInternational(address?: MongoAddress): {
  addressName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  addressLocality: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  addressLat: number | null;
  addressLng: number | null;
  addressGooglePlaceId: string | null;
  addressHours: string | null;
} {
  if (!address) {
    return {
      addressName: null,
      addressLine1: null,
      addressLine2: null,
      addressLine3: null,
      addressLocality: null,
      addressRegion: null,
      addressPostalCode: null,
      addressCountry: null,
      addressLat: null,
      addressLng: null,
      addressGooglePlaceId: null,
      addressHours: null,
    };
  }

  return {
    addressName: address.name || null,
    addressLine1: address.street1 || null,
    addressLine2: address.street2 || null,
    addressLine3: null, // US addresses don't typically need line3
    addressLocality: address.city || null,
    addressRegion: address.state || null,
    addressPostalCode: address.zipcode || null,
    addressCountry: 'US', // Default to US for existing data
    addressLat: address.lat ? parseFloat(address.lat) : null,
    addressLng: address.lng ? parseFloat(address.lng) : null,
    addressGooglePlaceId: address.google_place_id || null,
    addressHours: address.hours || null,
  };
}

/**
 * Convert MongoDB locations array to international format
 */
function locationsToInternational(locations?: any[]): any[] | null {
  if (!locations || locations.length === 0) return null;

  return locations.map((loc) => ({
    name: loc.name || null,
    line1: loc.street1 || null,
    line2: loc.street2 || null,
    line3: null,
    locality: loc.city || null,
    region: loc.state || null,
    postalCode: loc.zipcode || null,
    country: 'US',
    lat: loc.lat ? parseFloat(loc.lat) : null,
    lng: loc.lng ? parseFloat(loc.lng) : null,
    googlePlaceId: loc.google_place_id || null,
    hours: loc.hours || null,
  }));
}

async function migrateProfiles() {
  console.log('\n👤 Migrating Profiles from MongoDB to PostgreSQL\n');

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

    // Build user ID mapping: email -> PostgreSQL cuid
    console.log('Building user ID mapping...');
    const pgUsers = await prisma.user.findMany({
      select: { id: true, email: true },
    });

    const emailToPgUserId = new Map<string, string>();
    for (const user of pgUsers) {
      emailToPgUserId.set(user.email.toLowerCase(), user.id);
    }
    console.log(`  PostgreSQL users: ${emailToPgUserId.size}\n`);

    // Fetch profiles from MongoDB
    console.log('Fetching profiles from MongoDB...');
    const profiles = await db
      .collection<MongoProfile>('profiles')
      .find({})
      .toArray();
    console.log(`  Found: ${profiles.length} profiles\n`);

    if (profiles.length === 0) {
      console.log('✅ No profiles to migrate\n');
      return;
    }

    // Process profiles
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const toInsert: any[] = [];

    for (const profile of profiles) {
      // Map to PostgreSQL user ID via email
      const pgUserId = emailToPgUserId.get(profile.email.toLowerCase());

      // Transform pronouns
      const pronouns = pronounsToString(profile.pronouns);

      // Transform address
      const addressFields = addressToInternational(profile.primary_address);

      // Transform locations
      const locations = locationsToInternational(profile.locations);

      // Create descriptions JSONB
      const descriptions =
        profile.details ||
        profile.background ||
        profile.five_words ||
        profile.tags ||
        profile.hearaboutus
          ? {
              details: profile.details || null,
              background: profile.background || null,
              fiveWords: profile.five_words || null,
              tags: profile.tags || null,
              hearaboutus: profile.hearaboutus || null,
            }
          : null;

      // Gallery images (non-primary)
      const galleryImages =
        profile.images?.gallery1 ||
        profile.images?.gallery2 ||
        profile.images?.gallery3
          ? {
              gallery1: profile.images?.gallery1 || null,
              gallery1CDN: profile.images?.gallery1CDN || null,
              gallery2: profile.images?.gallery2 || null,
              gallery2CDN: profile.images?.gallery2CDN || null,
              gallery3: profile.images?.gallery3 || null,
              gallery3CDN: profile.images?.gallery3CDN || null,
            }
          : null;

      // Determine membership level (default to free)
      // This could be enhanced based on status/administrative fields
      const membershipLevel: MembershipLevel = 'free';

      toInsert.push({
        id: profile._id.toString(),
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,

        // Core immutable data
        userId: pgUserId || null,
        email: profile.email,
        name: profile.name,
        slug: profile.slug || null,
        phoneNumber: profile.phone_number || null,
        pronouns: pronouns,
        primaryImageId: profile.images?.primary || null,
        primaryImageCdn: profile.images?.primaryCDN || null,
        ...addressFields,
        active: profile.active || false,
        locallyBased: profile.locally_based || null,
        membershipLevel: membershipLevel,

        // Extended JSONB data
        descriptions: descriptions,
        socials: profile.socials || null,
        galleryImages: galleryImages,
        categories: profile.categories || null,
        counties: profile.counties || null,
        locations: locations,
        geo: profile.geo || null,
        mentoring: profile.mentoring || null,
        availability: profile.availability || null,
        verification: profile.verification || null,
        roles: profile.roles || null,
        gentedepana: profile.gentedepana || null,
        status: profile.status || null,
        administrative: profile.administrative || null,
        linkedProfiles: profile.linked_profiles || null,

        // Other fields
        whatsappCommunity: profile.whatsapp_community || false,
        affiliate: profile.affiliate || null,
      });

      migrated++;
    }

    console.log(`📊 Migration summary:`);
    console.log(`  To migrate: ${migrated}`);
    console.log(
      `  With linked user: ${toInsert.filter((p) => p.userId).length}`
    );
    console.log(
      `  Without linked user: ${toInsert.filter((p) => !p.userId).length}`
    );
    console.log('');

    if (DRY_RUN) {
      console.log('⚠️  DRY RUN - Skipping database writes\n');
      if (toInsert.length > 0) {
        console.log('Sample profile to insert:');
        const sample = { ...toInsert[0] };
        // Truncate long fields for display
        if (sample.descriptions?.details) {
          sample.descriptions.details =
            sample.descriptions.details.substring(0, 100) + '...';
        }
        console.log(JSON.stringify(sample, null, 2));
      }
    } else if (toInsert.length > 0) {
      console.log('Inserting profiles into PostgreSQL...');

      for (const profile of toInsert) {
        try {
          await prisma.profile.upsert({
            where: { id: profile.id },
            update: profile,
            create: profile,
          });
        } catch (error) {
          console.error(`  Error inserting profile ${profile.email}:`, error);
          errors++;
        }
      }

      console.log(`  Inserted ${toInsert.length - errors} profiles`);
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

migrateProfiles();
