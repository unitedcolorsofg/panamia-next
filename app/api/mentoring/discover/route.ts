import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { ProfileMentoring } from '@/lib/interfaces';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = await getPrisma();

  const { searchParams } = new URL(request.url);
  const expertise = searchParams.get('expertise');
  const language = searchParams.get('language');
  const freeOnly = searchParams.get('freeOnly') === 'true';

  // Build Prisma query with JSON path conditions
  const whereConditions: any = {
    email: { not: session.user.email },
    mentoring: {
      path: ['enabled'],
      equals: true,
    },
  };

  // Get all profiles with mentoring enabled and filter in JS
  // (Prisma JSON array contains requires raw queries)
  const profiles = await prisma.profile.findMany({
    where: whereConditions,
    select: {
      id: true,
      name: true,
      email: true,
      mentoring: true,
      availability: true,
      slug: true,
      primaryImageId: true,
      primaryImageCdn: true,
      galleryImages: true,
    },
    take: 100, // Get more to filter
  });

  // Filter by expertise, language, and hourly rate in JS
  let mentors = profiles.filter((p) => {
    const mentoring = p.mentoring as ProfileMentoring | null;
    if (!mentoring?.enabled) return false;

    if (expertise && !mentoring.expertise?.includes(expertise)) return false;
    if (language && !mentoring.languages?.includes(language)) return false;
    if (freeOnly && (mentoring.hourlyRate ?? 0) > 0) return false;

    return true;
  });

  // Transform to expected format and limit
  const formattedMentors = mentors.slice(0, 50).map((p) => ({
    _id: p.id,
    id: p.id,
    name: p.name,
    email: p.email,
    mentoring: p.mentoring,
    availability: p.availability,
    slug: p.slug,
    images: {
      primary: p.primaryImageId,
      primaryCDN: p.primaryImageCdn,
      ...((p.galleryImages as object) || {}),
    },
  }));

  return NextResponse.json({ mentors: formattedMentors });
}
