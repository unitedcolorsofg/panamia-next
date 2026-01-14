// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ensureProfile } from '@/lib/server/profile';
import { slugify } from '@/lib/standardized';

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

  // Use userId for profile lookup, with email fallback for unclaimed profiles
  const existingProfile = await ensureProfile(
    session.user.id,
    session.user.email
  );
  if (existingProfile) {
    if (name) {
      existingProfile.name = name;
      existingProfile.slug = slugify(name);
    }
    if (five_words) {
      existingProfile.five_words = five_words;
    }
    if (details) {
      existingProfile.details = details;
    }
    existingProfile.background = background;
    existingProfile.tags = tags;
    try {
      existingProfile.save();
    } catch (e) {
      if (e instanceof Error) {
        console.log(e.message);
        return NextResponse.json(
          { success: false, error: e.message },
          { status: 500 }
        );
      }
    }
    return NextResponse.json(
      { success: true, data: existingProfile },
      { status: 200 }
    );
  }
  return NextResponse.json({ success: false, error: 'Could not find pofile' });
}
