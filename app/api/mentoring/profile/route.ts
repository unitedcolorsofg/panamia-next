import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { ProfileMentoring } from '@/lib/interfaces';

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prisma = await getPrisma();

    const body = await request.json();
    const {
      enabled,
      expertise,
      languages,
      bio,
      videoIntroUrl,
      goals,
      hourlyRate,
    } = body;

    // Validate required fields
    if (!Array.isArray(expertise) || expertise.length === 0) {
      return NextResponse.json(
        { error: 'At least one expertise area is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(languages) || languages.length === 0) {
      return NextResponse.json(
        { error: 'At least one language is required' },
        { status: 400 }
      );
    }

    if (!bio || bio.length < 10) {
      return NextResponse.json(
        { error: 'Bio must be at least 10 characters' },
        { status: 400 }
      );
    }

    const mentoringData: ProfileMentoring = {
      enabled,
      expertise,
      languages,
      bio,
      videoIntroUrl: videoIntroUrl || '',
      goals: goals || '',
      hourlyRate: hourlyRate || 0,
    };

    const profile = await prisma.profile.update({
      where: { email: session.user.email },
      data: {
        mentoring: mentoringData as any,
      },
    });

    return NextResponse.json({
      success: true,
      mentoring: profile.mentoring,
    });
  } catch (error) {
    console.error('Error updating mentoring profile:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: `Failed to update profile: ${errorMessage}` },
      { status: 500 }
    );
  }
}
