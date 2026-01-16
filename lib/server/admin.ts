// Admin search and dashboard utilities
import { getPrisma } from '@/lib/prisma';
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

  const prisma = await getPrisma();
  const skip = pageNum > 1 ? (pageNum - 1) * pageLimit : 0;

  // Basic search using ILIKE for name and email
  const profiles = await prisma.profile.findMany({
    where: {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      socials: true,
      descriptions: true,
      primaryImageCdn: true,
      addressLocality: true,
      geo: true,
    },
    skip,
    take: pageLimit,
    orderBy: { name: 'asc' },
  });

  // Transform to match expected format
  const data = profiles.map((p) => {
    const descriptions = p.descriptions as ProfileDescriptions | null;
    return {
      _id: p.id,
      id: p.id,
      name: p.name,
      slug: p.slug,
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
  const prisma = await getPrisma();

  const recentProfiles = await prisma.profile.findMany({
    where: {
      createdAt: { gte: dateXdays(35) },
    },
    orderBy: { createdAt: 'desc' },
  });

  const allProfiles = await prisma.profile.count();

  return { recent: recentProfiles, all: allProfiles };
};
