import dbConnect from '@/lib/connectdb';
import profile from '@/lib/model/profile';

/**
 * Get profile by email address
 */
export const getProfile = async (email: string) => {
  await dbConnect();
  // TODO: Remove type assertion after upgrading to Mongoose v8 in Phase 5
  return await (profile as any).findOne({ email: email });
};

/**
 * Get profile by public handle/slug
 */
export const getPublicProfile = async (handle: string) => {
  await dbConnect();
  // TODO: Remove type assertion after upgrading to Mongoose v8 in Phase 5
  return await (profile as any).findOne({ slug: handle });
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
  await dbConnect();
  // TODO: Remove type assertion after upgrading to Mongoose v8 in Phase 5
  return await (profile as any).findOne({ userId });
};

/**
 * Ensure a profile exists for a user, optionally claiming an unclaimed profile.
 *
 * This is the "lazy profile creation" pattern for the MongoDB/PostgreSQL
 * polyglot architecture. It handles the common case where:
 * 1. User signs in via OAuth/email (PostgreSQL user created)
 * 2. An unclaimed profile may exist from manual admin creation
 * 3. Profile should be linked to the authenticated user
 *
 * NOTE: This does NOT auto-create profiles because profiles require
 * user-provided fields (name, five_words). Use createExpressProfile
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
  await dbConnect();

  // First, try to find profile by userId
  let userProfile = await (profile as any).findOne({ userId });

  if (userProfile) {
    return userProfile;
  }

  // If email provided, try to claim an unclaimed profile
  if (email) {
    const unclaimedProfile = await (profile as any).findOne({
      email: email.toLowerCase(),
      $or: [{ userId: { $exists: false } }, { userId: null }],
    });

    if (unclaimedProfile) {
      unclaimedProfile.userId = userId;
      await unclaimedProfile.save();
      return unclaimedProfile;
    }
  }

  // No profile exists - return null (caller should direct user to create one)
  return null;
};
