/**
 * GET /api/social/follows - Get current user's following or followers
 * Query params: type=following|followers
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getFollowers, getFollowing } from '@/lib/federation';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get user's actor
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
    with: { socialActor: true },
  });

  if (!profile?.socialActor) {
    return NextResponse.json({
      success: true,
      data: { actors: [], nextCursor: null },
    });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') || 'following';
  const cursor = searchParams.get('cursor') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  let result;
  if (type === 'followers') {
    result = await getFollowers(profile.socialActor.id, cursor, limit);
  } else {
    result = await getFollowing(profile.socialActor.id, cursor, limit);
  }

  return NextResponse.json({
    success: true,
    data: result,
  });
}
