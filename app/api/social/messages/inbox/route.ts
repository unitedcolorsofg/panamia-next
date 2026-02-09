/**
 * GET /api/social/messages/inbox - Get posts that @-mention the user
 *
 * Returns both DMs and public posts that mention the user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { getAtMeTimeline } from '@/lib/federation';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const prisma = await getPrisma();

  // Get user's actor
  const profile = await prisma.profile.findFirst({
    where: { userId: session.user.id },
    include: { socialActor: true },
  });

  if (!profile?.socialActor) {
    return NextResponse.json({
      success: true,
      data: { statuses: [], nextCursor: null },
    });
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get('cursor') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  const result = await getAtMeTimeline(profile.socialActor.id, cursor, limit);

  return NextResponse.json({
    success: true,
    data: result,
  });
}
