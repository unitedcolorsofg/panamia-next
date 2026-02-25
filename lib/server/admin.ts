// Admin search and dashboard utilities
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { and, asc, gte, ilike, or, sql } from 'drizzle-orm';
import { ProfileDescriptions } from '@/lib/interfaces';
import { AdminSearchInterface } from '../query/admin';
import { dateXdays } from '../standardized';

/**
 * Admin search for profiles
 * Uses PostgreSQL ILIKE for basic search (Atlas Search removed in migration)
 */
export const getAdminSearch = async ({
  pageNum,
  pageLimit,
  searchTerm,
}: AdminSearchInterface) => {
  console.log('getAdminSearch');

  if (!searchTerm) {
    return { success: false, data: [] };
  }

  const skip = pageNum > 1 ? (pageNum - 1) * pageLimit : 0;

  const profilesList = await db.query.profiles.findMany({
    where: or(
      ilike(profiles.name, `%${searchTerm}%`),
      ilike(profiles.email, `%${searchTerm}%`)
    ),
    columns: {
      id: true,
      name: true,
      socials: true,
      descriptions: true,
      primaryImageCdn: true,
      addressLocality: true,
      geo: true,
    },
    with: { user: { columns: { screenname: true } } },
    offset: skip,
    limit: pageLimit,
    orderBy: (p, { asc }) => [asc(p.name)],
  });

  // Transform to match expected format
  const data = profilesList.map((p) => {
    const descriptions = p.descriptions as ProfileDescriptions | null;
    return {
      _id: p.id,
      id: p.id,
      name: p.name,
      screenname: p.user?.screenname || null,
      socials: p.socials,
      five_words: descriptions?.fiveWords,
      details: descriptions?.details,
      images: { primaryCDN: p.primaryImageCdn },
      primary_address: { city: p.addressLocality },
      geo: p.geo,
    };
  });

  return { success: true, data };
};

export const getAdminDashboard = async () => {
  const recentProfiles = await db.query.profiles.findMany({
    where: gte(profiles.createdAt, dateXdays(35)),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });

  const [{ count }] = await db
    .select({ count: sql<string>`count(*)` })
    .from(profiles);

  return { recent: recentProfiles, all: Number(count) };
};
