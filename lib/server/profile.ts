import {
  addProfileOwner,
  notBusinessListing,
} from '@/lib/server/profile-owners';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  ProfileDescriptions,
  ProfileMentoring,
  ProfileSocialsInterface,
} from '@/lib/interfaces';

export interface LegacyProfile {
  id: string;
  name: string;
  details: string | undefined;
  five_words: string | undefined;
  background: string | undefined;
  tags: string | undefined;
  phone_number: unknown;
  /** Set by Pana Mia staff; null means not certified. */
  panaCertifiedAt: Date | null;
  /** True when the business has no location to visit. */
  onlineOnly: boolean;
  primary_address: {
    name: string | undefined;
    street1: string | undefined;
    street2: string | undefined;
    city: string | undefined;
    state: string | undefined;
    zipcode: string | undefined;
    country: string | undefined;
  };
  images: {
    primaryCDN: string | undefined;
    gallery1CDN: string | undefined;
    gallery2CDN: string | undefined;
    gallery3CDN: string | undefined;
  };
  geo: { type: string; coordinates: number[] } | null;
  mentoring: ProfileMentoring | null;
  socials: ProfileSocialsInterface | null;
  [key: string]: unknown;
}

/**
 * Pull [lng, lat] out of a profile row.
 *
 * address_lat/address_lng are authoritative — they are what the address
 * geocoder writes. The geo JSONB column is read only as a fallback for rows
 * imported before those columns existed.
 *
 * Both are validated rather than trusted: numeric columns arrive from the
 * driver as strings, and a half-populated row (lat set, lng NULL) would
 * otherwise produce a point at the equator.
 */
function extractCoordinates(
  profile: Record<string, unknown>
): [number, number] | null {
  const lat = Number(profile.addressLat);
  const lng = Number(profile.addressLng);

  if (
    profile.addressLat != null &&
    profile.addressLng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return [lng, lat];
  }

  const geo = profile.geo as { coordinates?: unknown } | null;
  const legacy = Array.isArray(geo?.coordinates) ? geo.coordinates : null;
  if (legacy && legacy.length >= 2) {
    const [legacyLng, legacyLat] = [Number(legacy[0]), Number(legacy[1])];
    if (Number.isFinite(legacyLng) && Number.isFinite(legacyLat)) {
      return [legacyLng, legacyLat];
    }
  }

  return null;
}

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
function transformToLegacyFormat(
  profile: Record<string, unknown> & {
    descriptions?: unknown;
    mentoring?: unknown;
  }
): LegacyProfile {
  const descriptions = profile.descriptions as ProfileDescriptions | null;
  const mentoring = profile.mentoring as ProfileMentoring | null;

  return {
    ...profile,
    // Explicit typed fields (cast from Record<string, unknown>)
    id: profile.id as string,
    name: profile.name as string,
    panaCertifiedAt: (profile.panaCertifiedAt as Date | null) ?? null,
    // Declared explicitly rather than left to the spread so it survives the
    // Record<string, unknown> cast with a real boolean type. Defaults to
    // false: a row that predates the column is a physical business.
    onlineOnly: (profile.onlineOnly as boolean | null) ?? false,
    // Legacy field mappings
    details: descriptions?.details,
    five_words: descriptions?.fiveWords,
    background: descriptions?.background,
    tags: descriptions?.tags,
    phone_number: profile.phoneNumber,
    // Legacy address format
    primary_address: {
      name: profile.addressName as string | undefined,
      street1: profile.addressLine1 as string | undefined,
      street2: profile.addressLine2 as string | undefined,
      city: profile.addressLocality as string | undefined,
      state: profile.addressRegion as string | undefined,
      zipcode: profile.addressPostalCode as string | undefined,
      country: profile.addressCountry as string | undefined,
    },
    // Legacy image format. Gallery slots live inside the gallery_images JSONB
    // column as { gallery1CDN, gallery2CDN, ... } — written that way by
    // /api/profile/upload. The previous implementation read gallery1Cdn/
    // gallery2Cdn/gallery3Cdn, which are not columns on this table, so the
    // gallery was unconditionally empty.
    images: (() => {
      const gallery = (profile.galleryImages ?? {}) as Record<
        string,
        string | undefined
      >;
      return {
        primaryCDN: profile.primaryImageCdn as string | undefined,
        gallery1CDN: gallery.gallery1CDN,
        gallery2CDN: gallery.gallery2CDN,
        gallery3CDN: gallery.gallery3CDN,
      };
    })(),
    // Legacy geo format. Reads the authoritative address_lat/address_lng
    // columns; the previous implementation referenced geoLat/geoLng, which are
    // not columns on this table, so geo was unconditionally null and the map
    // and distance never rendered.
    geo: (() => {
      const coordinates = extractCoordinates(profile);
      return coordinates ? { type: 'Point', coordinates } : null;
    })(),
    // Mentoring stays as-is (JSONB)
    mentoring: mentoring,
    // Socials stays as-is (JSONB)
    socials: profile.socials as ProfileSocialsInterface | null,
  };
}

/**
 * Get profile by public handle (User.screenname)
 * Returns profile in legacy format for page components
 */
export const getPublicProfile = async (handle: string) => {
  // Resolve profile-first. Business listings own their handle directly and have
  // no linked user, so a users-only lookup would 404 them. Personal profiles
  // are found the same way because screenname/set mirrors the handle onto the
  // profile; the users fallback below covers rows predating that mirror.
  const profile = await db.query.profiles.findFirst({
    where: sql`lower(${profiles.screenname}) = lower(${handle})`,
    with: { user: { columns: { screenname: true } } },
  });

  if (profile) {
    return transformToLegacyFormat({
      ...profile,
      user: { screenname: profile.screenname ?? profile.user?.screenname },
    });
  }

  const user = await db.query.users.findFirst({
    where: sql`lower(${users.screenname}) = lower(${handle})`,
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
        isNull(profiles.userId),
        // Same exclusion as auth.ts: an unclaimed *business* listing must not
        // become this user's personal profile. See lib/server/profile-owners.ts.
        notBusinessListing
      ),
    });

    if (unclaimedProfile) {
      const [claimed] = await db
        .update(profiles)
        .set({ userId })
        .where(eq(profiles.id, unclaimedProfile.id))
        .returning();

      await addProfileOwner(unclaimedProfile.id, userId);

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
