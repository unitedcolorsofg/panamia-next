import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { ProfileDescriptions, ProfileMentoring } from '@/lib/interfaces';

/**
 * Directory API - List and search profiles
 *
 * Query Parameters:
 * - q: Search term (searches name, descriptions)
 * - email: Get single profile by email
 * - screenname: Get single profile by screenname
 * - category: Filter by category (e.g., "art", "food")
 * - location: Filter by county (e.g., "miami_dade", "broward")
 * - mentors: If "true", only show mentor profiles
 * - page: Page number (default 1)
 * - limit: Results per page (default 20, max 100)
 * - random: If "true", return random profiles (for homepage)
 */
export async function GET(request: NextRequest) {
  const prisma = await getPrisma();
  const searchParams = request.nextUrl.searchParams;

  // Parse query parameters
  const email = searchParams.get('email')?.toLowerCase().trim();
  const screenname = searchParams.get('screenname')?.toLowerCase().trim();
  const searchTerm = searchParams.get('q')?.trim() || '';
  const category = searchParams.get('category');
  const location = searchParams.get('location');
  const mentorsOnly = searchParams.get('mentors') === 'true';
  const randomMode = searchParams.get('random') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('limit') || '20', 10))
  );

  try {
    // Single profile lookup by email
    if (email) {
      const profile = await prisma.profile.findFirst({
        where: { email, active: true },
        include: { user: { select: { screenname: true } } },
      });

      if (!profile) {
        return NextResponse.json(
          { error: 'Profile not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: transformProfile(profile),
      });
    }

    // Single profile lookup by screenname (via User)
    if (screenname) {
      const profile = await prisma.profile.findFirst({
        where: {
          user: { screenname },
          active: true,
        },
        include: { user: { select: { screenname: true } } },
      });

      if (!profile) {
        return NextResponse.json(
          { error: 'Profile not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: transformProfile(profile),
      });
    }

    // Random profiles (for homepage discovery)
    if (randomMode) {
      const allProfiles = await prisma.profile.findMany({
        where: { active: true },
        include: { user: { select: { screenname: true } } },
      });

      // Shuffle and take limit
      const shuffled = allProfiles
        .sort(() => Math.random() - 0.5)
        .slice(0, limit);

      return NextResponse.json({
        success: true,
        data: shuffled.map(transformProfile),
        pagination: {
          page: 1,
          limit,
          total: allProfiles.length,
        },
      });
    }

    // Directory listing with filters
    const profiles = await prisma.profile.findMany({
      where: { active: true },
      include: { user: { select: { screenname: true } } },
      orderBy: { name: 'asc' },
    });

    let filtered = profiles;

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((p) => {
        const descriptions = p.descriptions as ProfileDescriptions | null;

        if (p.name.toLowerCase().includes(searchLower)) return true;
        if (descriptions?.fiveWords?.toLowerCase().includes(searchLower))
          return true;
        if (descriptions?.tags?.toLowerCase().includes(searchLower))
          return true;
        if (descriptions?.details?.toLowerCase().includes(searchLower))
          return true;
        if (descriptions?.background?.toLowerCase().includes(searchLower))
          return true;

        return false;
      });
    }

    // Filter by category
    if (category) {
      filtered = filtered.filter((p) => {
        const categories = p.categories as Record<string, boolean> | null;
        return categories?.[category] === true;
      });
    }

    // Filter by location (county)
    if (location) {
      filtered = filtered.filter((p) => {
        const counties = p.counties as Record<string, boolean> | null;
        return counties?.[location] === true;
      });
    }

    // Filter by mentoring enabled
    if (mentorsOnly) {
      filtered = filtered.filter((p) => {
        const mentoring = p.mentoring as ProfileMentoring | null;
        return mentoring?.enabled === true;
      });
    }

    // Pagination
    const total = filtered.length;
    const skip = (page - 1) * limit;
    const paginated = filtered.slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      data: paginated.map(transformProfile),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Directory API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch directory' },
      { status: 500 }
    );
  }
}

/**
 * Transform Prisma profile to API response format
 */
function transformProfile(p: any) {
  const descriptions = p.descriptions as ProfileDescriptions | null;
  const mentoring = p.mentoring as ProfileMentoring | null;

  return {
    id: p.id,
    name: p.name,
    screenname: p.user?.screenname || null,
    email: p.email,
    pronouns: p.pronouns,
    fiveWords: descriptions?.fiveWords,
    details: descriptions?.details,
    tags: descriptions?.tags,
    primaryImage: p.primaryImageCdn,
    address: {
      locality: p.addressLocality,
      region: p.addressRegion,
      country: p.addressCountry,
    },
    categories: p.categories,
    counties: p.counties,
    socials: p.socials,
    mentoring: mentoring?.enabled
      ? {
          enabled: true,
          expertise: mentoring.expertise,
          languages: mentoring.languages,
          hourlyRate: mentoring.hourlyRate,
        }
      : undefined,
  };
}

export const maxDuration = 10;
