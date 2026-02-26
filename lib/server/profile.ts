import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { ProfileDescriptions, ProfileMentoring } from '@/lib/interfaces';

/**
 * Get profile by email address
 */
export const getProfile = async (email: string) => {
  return await db.query.profiles.findFirst({
    where: eq(profiles.email, email),
  });
};

/**
 * Transform Drizzle profile to legacy format for page components
 * This provides backward compatibility during migration
 */
function transformToLegacyFormat(profile: any) {
  const descriptions = profile.descriptions as ProfileDescriptions | null;
  const mentoring = profile.mentoring as ProfileMentoring | null;

  return {
    ...profile,
    // Legacy field mappings
    details: descriptions?.details,
    five_words: descriptions?.fiveWords,
    background: descriptions?.background,
    tags: descriptions?.tags,
    phone_number: profile.phoneNumber,
    // Legacy address format
    primary_address: {
      name: profile.addressName,
      street1: profile.addressLine1,
      street2: profile.addressLine2,
      city: profile.addressLocality,
      state: profile.addressRegion,
      zipcode: profile.addressPostalCode,
      country: profile.addressCountry,
    },
    // Legacy image format
    images: {
      primaryCDN: profile.primaryImageCdn,
      gallery1CDN: profile.gallery1Cdn,
      gallery2CDN: profile.gallery2Cdn,
      gallery3CDN: profile.gallery3Cdn,
    },
    // Legacy geo format (combine lat/lng into GeoJSON-like structure)
    geo:
      profile.geoLat && profile.geoLng
        ? {
            type: 'Point',
            coordinates: [Number(profile.geoLng), Number(profile.geoLat)],
          }
        : null,
    // Mentoring stays as-is (JSONB)
    mentoring: mentoring,
    // Socials stays as-is (JSONB)
    socials: profile.socials,
  };
}

/**
 * Get profile by public handle (User.screenname)
 * Returns profile in legacy format for page components
 */
export const getPublicProfile = async (handle: string) => {
  // Query via user (screenname is on User, not Profile)
  const user = await db.query.users.findFirst({
    where: eq(users.screenname, handle),
    with: { profile: true },
  });

  if (!user?.profile) return null;

  return transformToLegacyFormat({
    ...user.profile,
    user: { screenname: user.screenname },
  });
};

/**
 * Get profile by PostgreSQL user ID (cuid format)
 *
 * This is the primary lookup method for authenticated users.
 * After auth migration to PostgreSQL, profiles are linked via userId.
 *
 * @param userId - PostgreSQL User.id (cuid format)
 * @returns Profile document or null if not found
 */
export const getProfileByUserId = async (userId: string) => {
  return await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });
};

/**
 * Ensure a profile exists for a user, optionally claiming an unclaimed profile.
 *
 * This is the "lazy profile creation" pattern for the PostgreSQL
 * architecture. It handles the common case where:
 * 1. User signs in via OAuth/email (PostgreSQL user created)
 * 2. An unclaimed profile may exist from manual admin creation
 * 3. Profile should be linked to the authenticated user
 *
 * NOTE: This does NOT auto-create profiles because profiles require
 * user-provided fields (name, descriptions.fiveWords). Use createExpressProfile
 * API for explicit profile creation.
 *
 * @param userId - PostgreSQL User.id (cuid format)
 * @param email - User's email for claiming unclaimed profiles
 * @returns Profile document or null if no profile exists
 *
 * @see auth.ts signIn callback for automatic claiming at sign-in
 * @see docs/DATABASE-DESIGN.md for architecture details
 */
export const ensureProfile = async (userId: string, email?: string) => {
  // First, try to find profile by userId (including user for screenname)
  const userProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    with: { user: { columns: { screenname: true } } },
  });

  if (userProfile) {
    // Add screenname to returned profile for legacy compatibility
    return {
      ...userProfile,
      screenname: userProfile.user?.screenname,
    };
  }

  // If email provided, try to claim an unclaimed profile
  if (email) {
    const unclaimedProfile = await db.query.profiles.findFirst({
      where: and(
        eq(profiles.email, email.toLowerCase()),
        isNull(profiles.userId)
      ),
    });

    if (unclaimedProfile) {
      const [claimed] = await db
        .update(profiles)
        .set({ userId })
        .where(eq(profiles.id, unclaimedProfile.id))
        .returning();

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { screenname: true },
      });

      return {
        ...claimed,
        screenname: user?.screenname,
        user: { screenname: user?.screenname },
      };
    }
  }

  // No profile exists - return null (caller should direct user to create one)
  return null;
};
