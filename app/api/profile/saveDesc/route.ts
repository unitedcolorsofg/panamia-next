// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { slugify } from '@/lib/standardized';
import { ProfileDescriptions } from '@/lib/interfaces';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({
      success: false,
      error: 'No user session available',
    });
  }

  const { name, five_words, details, background, tags } = body;

  const prisma = await getPrisma();

  // Find user's profile
  const existingProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (!existingProfile) {
    return NextResponse.json({
      success: false,
      error: 'Could not find profile',
    });
  }

  // Build update data
  const updateData: any = {};

  if (name) {
    updateData.name = name;
  }

  // Merge with existing descriptions
  const existingDescriptions =
    existingProfile.descriptions as ProfileDescriptions | null;
  const descriptions: ProfileDescriptions = {
    fiveWords: five_words || existingDescriptions?.fiveWords,
    details: details || existingDescriptions?.details,
    background: background ?? existingDescriptions?.background,
    tags: tags ?? existingDescriptions?.tags,
    hearaboutus: existingDescriptions?.hearaboutus,
  };
  updateData.descriptions = descriptions;

  try {
    const updatedProfile = await prisma.profile.update({
      where: { id: existingProfile.id },
      data: updateData,
    });

    return NextResponse.json(
      { success: true, data: updatedProfile },
      { status: 200 }
    );
  } catch (e) {
    if (e instanceof Error) {
      console.log(e.message);
      return NextResponse.json(
        { success: false, error: e.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Unknown error' },
      { status: 500 }
    );
  }
}
