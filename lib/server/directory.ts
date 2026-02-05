// Directory search utilities (migrated from MongoDB Atlas Search to PostgreSQL)
import { getPrisma } from '@/lib/prisma';
import { ProfileDescriptions, ProfileMentoring } from '@/lib/interfaces';

interface SearchInterface {
  pageNum: number;
  pageLimit: number;
  searchTerm: string;
  filterLocations: string;
  filterCategories: string;
  random: number;
  geolat: string;
  geolng: string;
  resultsView: string;
  mentorsOnly?: boolean;
  expertise?: string;
  languages?: string;
  freeOnly?: boolean;
}

/**
 * Profile directory search
 * Converted from MongoDB Atlas Search to PostgreSQL ILIKE
 * Note: Geo-based scoring and fuzzy search are simplified in this version
 */
export const getSearch = async ({
  pageNum,
  pageLimit,
  searchTerm,
  filterLocations,
  filterCategories,
  random,
  geolat,
  geolng,
  resultsView,
  mentorsOnly,
  expertise,
  languages,
  freeOnly,
}: SearchInterface) => {
  console.log('getSearch');
  const prisma = await getPrisma();

  // Random profiles
  if (random > 0) {
    // PostgreSQL doesn't have $sample, so we use a workaround
    // Get all active profiles and shuffle in memory (for small datasets)
    const allProfiles = await prisma.profile.findMany({
      where: { active: true },
      include: { user: { select: { screenname: true } } },
    });

    // Shuffle and take pageLimit
    const shuffled = allProfiles
      .sort(() => Math.random() - 0.5)
      .slice(0, pageLimit);

    // Transform to expected format
    const data = shuffled.map((p) => transformProfile(p));
    return { success: true, data };
  }

  if (searchTerm) {
    const skip = pageNum > 1 ? (pageNum - 1) * pageLimit : 0;

    // Build where clause
    const whereConditions: any = {
      active: true,
    };

    // Get all matching profiles and filter in memory for complex conditions
    const profiles = await prisma.profile.findMany({
      where: whereConditions,
      include: { user: { select: { screenname: true } } },
      orderBy: { name: 'asc' },
    });

    // Filter by search term (name, descriptions)
    let filtered = profiles.filter((p) => {
      const descriptions = p.descriptions as ProfileDescriptions | null;
      const searchLower = searchTerm.toLowerCase();

      // Search in name
      if (p.name.toLowerCase().includes(searchLower)) return true;

      // Search in descriptions
      if (descriptions?.fiveWords?.toLowerCase().includes(searchLower))
        return true;
      if (descriptions?.tags?.toLowerCase().includes(searchLower)) return true;
      if (descriptions?.details?.toLowerCase().includes(searchLower))
        return true;
      if (descriptions?.background?.toLowerCase().includes(searchLower))
        return true;

      return false;
    });

    // Filter by location (counties)
    if (filterLocations) {
      const locs = filterLocations.split('+');
      filtered = filtered.filter((p) => {
        const counties = p.counties as Record<string, boolean> | null;
        if (!counties) return false;
        return locs.some((loc) => counties[loc] === true);
      });
    }

    // Filter by categories
    if (filterCategories) {
      const cats = filterCategories.split('+');
      filtered = filtered.filter((p) => {
        const categories = p.categories as Record<string, boolean> | null;
        if (!categories) return false;
        return cats.some((cat) => categories[cat] === true);
      });
    }

    // Filter by mentoring
    if (mentorsOnly || expertise || languages || freeOnly) {
      filtered = filtered.filter((p) => {
        const mentoring = p.mentoring as ProfileMentoring | null;
        if (!mentoring?.enabled) return false;

        if (expertise && !mentoring.expertise?.includes(expertise))
          return false;
        if (languages && !mentoring.languages?.includes(languages))
          return false;
        if (freeOnly && (mentoring.hourlyRate ?? 0) > 0) return false;

        return true;
      });
    }

    // Paginate
    const paginated = filtered.slice(skip, skip + pageLimit);

    // Transform to expected format
    const data = paginated.map((p) => transformProfile(p));

    return { success: true, data };
  }

  return { success: false, data: [] };
};

/**
 * Transform Prisma profile to expected output format
 */
function transformProfile(p: any) {
  const descriptions = p.descriptions as ProfileDescriptions | null;
  const mentoring = p.mentoring as ProfileMentoring | null;

  return {
    _id: p.id,
    id: p.id,
    name: p.name,
    screenname: p.user?.screenname || null,
    socials: p.socials,
    five_words: descriptions?.fiveWords,
    details: descriptions?.details,
    images: {
      primaryCDN: p.primaryImageCdn,
    },
    primary_address: {
      city: p.addressLocality,
    },
    geo: p.geo,
    mentoring: mentoring
      ? {
          enabled: mentoring.enabled,
          expertise: mentoring.expertise,
          languages: mentoring.languages,
          hourlyRate: mentoring.hourlyRate,
        }
      : undefined,
  };
}
