import { getPrisma } from '@/lib/prisma';
import { ProfileDescriptions, ProfileMentoring } from '@/lib/interfaces';

/**
 * Get profile by email address
 */
export const getProfile = async (email: string) => {
  const prisma = await getPrisma();
  return await prisma.profile.findUnique({ where: { email } });
};

/**
 * Transform Prisma profile to legacy format for page components
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
  const prisma = await getPrisma();
  const profile = await prisma.profile.findFirst({
    where: { user: { screenname: handle } },
    include: { user: { select: { screenname: true } } },
  });
  if (!profile) return null;
  return transformToLegacyFormat(profile);
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
  const prisma = await getPrisma();
  return await prisma.profile.findUnique({ where: { userId } });
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
 * @see docs/DATABASE-ROADMAP.md for architecture details
 */
export const ensureProfile = async (userId: string, email?: string) => {
  const prisma = await getPrisma();

  // First, try to find profile by userId
  const userProfile = await prisma.profile.findUnique({ where: { userId } });

  if (userProfile) {
    return userProfile;
  }

  // If email provided, try to claim an unclaimed profile
  if (email) {
    const unclaimedProfile = await prisma.profile.findFirst({
      where: {
        email: email.toLowerCase(),
        userId: null,
      },
    });

    if (unclaimedProfile) {
      return await prisma.profile.update({
        where: { id: unclaimedProfile.id },
        data: { userId },
      });
    }
  }

  // No profile exists - return null (caller should direct user to create one)
  return null;
};
