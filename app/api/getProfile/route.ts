import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ensureProfile } from '@/lib/server/profile';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'No user session available' },
      { status: 401 }
    );
  }

  // Use userId for profile lookup, with email fallback for unclaimed profiles
  const existingProfile = await ensureProfile(
    session.user.id,
    session.user.email
  );

  if (existingProfile) {
    return NextResponse.json({ success: true, data: existingProfile });
  }

  return NextResponse.json({ success: true });
}

export const maxDuration = 5;
