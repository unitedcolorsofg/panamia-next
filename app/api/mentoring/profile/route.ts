import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import Profile from '@/lib/model/profile';

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();

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

    const profile = await Profile.findOneAndUpdate(
      { email: session.user.email },
      {
        $set: {
          'mentoring.enabled': enabled,
          'mentoring.expertise': expertise,
          'mentoring.languages': languages,
          'mentoring.bio': bio,
          'mentoring.videoIntroUrl': videoIntroUrl || '',
          'mentoring.goals': goals || '',
          'mentoring.hourlyRate': hourlyRate || 0,
        },
      },
      { new: true, upsert: true }
    );

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
