import { db } from '@/lib/db';
import { users, profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { generateAffiliateCode } from '../standardized';

/**
 * Get user by email
 * Now uses PostgreSQL via Drizzle
 */
export const getUser = async (email: string) => {
  return await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
};

/**
 * Generate a unique affiliate code
 * Checks against Profile.affiliate field
 */
export const uniqueAffiliateCode = async () => {
  let affiliateCode = '';
  for (let i = 0; i < 5; i++) {
    // if 5 loops all match something is wrong
    affiliateCode = generateAffiliateCode();
    const profile = await getProfileByAffiliateCode(affiliateCode);
    if (!profile) {
      break; // unique affiliate code found
    }
  }
  return affiliateCode;
};

/**
 * Get profile by affiliate code
 * Affiliate code is stored in Profile.affiliate String field
 */
export const getProfileByAffiliateCode = async (code: string) => {
  return await db.query.profiles.findFirst({
    where: eq(profiles.affiliate, code),
  });
};

// Legacy alias for backwards compatibility
export const getUserByAffiliateCode = getProfileByAffiliateCode;
