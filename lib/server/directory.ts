// Directory search utilities (migrated from MongoDB Atlas Search to PostgreSQL)
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { DIRECTORY_ACCOUNT_TYPES } from '@/lib/accounts';
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
  geolat: _geolat,
  geolng: _geolng,
  resultsView: _resultsView,
  mentorsOnly,
  expertise,
  languages,
  freeOnly,
}: SearchInterface) => {
  console.log('getSearch');

  const isBrowse = !searchTerm;

  // Browse mode only makes sense with a random seed; without one there is
  // nothing to show.
  if (isBrowse && random <= 0) {
    return {
      success: false,
      data: [],
      pagination: { page: 1, limit: pageLimit, total: 0, totalPages: 0 },
    };
  }

  // Get all listable profiles and filter in memory for complex conditions
  const allProfiles = await db.query.profiles.findMany({
    where: and(
      eq(profiles.active, true),
      // Every signed-in user now has an active profile, so `active` alone no
      // longer distinguishes a listing from a member. Narrow by account type in
      // SQL rather than in the in-memory passes below, which would otherwise
      // scan every personal account on each search.
      or(
        // Unclaimed legacy listings predate accounts entirely — they have no
        // user to carry an account type, but they are listings by definition.
        isNull(profiles.userId),
        inArray(
          profiles.userId,
          db
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.accountType, DIRECTORY_ACCOUNT_TYPES))
        )
      )
    ),
    with: { user: { columns: { screenname: true } } },
    orderBy: (p, { asc }) => [asc(p.name)],
  });

  let filtered = allProfiles;

  // Filter by search term (name, descriptions)
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    filtered = filtered.filter((p) => {
      const descriptions = p.descriptions as ProfileDescriptions | null;

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
  }

  // Filter by location (counties)
  if (filterLocations) {
    const locs = filterLocations.split('+').filter(Boolean);
    filtered = filtered.filter((p) => {
      const counties = p.counties as Record<string, boolean> | null;
      if (!counties) return false;
      return locs.some((loc) => counties[loc] === true);
    });
  }

  // Filter by categories
  if (filterCategories) {
    const cats = filterCategories.split('+').filter(Boolean);
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

      if (expertise && !mentoring.expertise?.includes(expertise)) return false;
      if (languages && !mentoring.languages?.includes(languages)) return false;
      if (freeOnly && (mentoring.hourlyRate ?? 0) > 0) return false;

      return true;
    });
  }

  // Browse: a random sample of whatever survived the filters. Filters are
  // applied first so that browsing with filters narrows the sample rather
  // than ignoring it.
  if (isBrowse) {
    const data = shuffle(filtered)
      .slice(0, pageLimit)
      .map((p) => transformProfile(p));
    // A random sample has no further pages: walking to page 2 would reshuffle
    // and repeat profiles, so browse always reports a single page.
    return {
      success: true,
      data,
      pagination: {
        page: 1,
        limit: pageLimit,
        total: data.length,
        totalPages: 1,
      },
    };
  }

  // Paginate
  const total = filtered.length;
  const skip = pageNum > 1 ? (pageNum - 1) * pageLimit : 0;
  const data = filtered
    .slice(skip, skip + pageLimit)
    .map((p) => transformProfile(p));

  return {
    success: true,
    data,
    pagination: {
      page: pageNum,
      limit: pageLimit,
      total,
      totalPages: Math.ceil(total / pageLimit),
    },
  };
};

/**
 * Fisher-Yates on a copy. `.sort(() => Math.random() - 0.5)` is both
 * statistically biased and mutates the array it is given.
 */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Transform Drizzle profile to expected output format
 */
function transformProfile(
  p: Record<string, unknown> & {
    user?: { screenname?: string | null } | null;
    descriptions?: unknown;
    mentoring?: unknown;
  }
) {
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
