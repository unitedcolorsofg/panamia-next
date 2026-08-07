import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ensureProfile } from '@/lib/server/profile';

export async function GET(_request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'No user session available' },
      { status: 401 }
    );
  }

  // Breadcrumb pair around the profile read. This route hung in production
  // with no error and no response (CF ray a2776034e8199aa6); a "start" with no
  // "done" pins the stall to ensureProfile rather than to auth() above it.
  console.log('[getProfile] ensureProfile start', { userId: session.user.id });

  // Use userId for profile lookup, with email fallback for unclaimed profiles
  const existingProfile = await ensureProfile(
    session.user.id,
    session.user.email
  );

  console.log('[getProfile] ensureProfile done', {
    userId: session.user.id,
    found: Boolean(existingProfile),
  });

  if (existingProfile) {
    return NextResponse.json({ success: true, data: existingProfile });
  }

  return NextResponse.json({ success: true });
}
