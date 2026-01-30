/**
 * GET /api/social/actors/[username]/posts - Get actor's posts
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { getActorByScreenname, getActorPosts } from '@/lib/federation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const actor = await getActorByScreenname(username);

  if (!actor) {
    return NextResponse.json(
      { success: false, error: 'Actor not found' },
      { status: 404 }
    );
  }

  // Get viewer's actor if authenticated
  let viewerActorId: string | undefined;
  const session = await auth();

  if (session?.user?.id) {
    const prisma = await getPrisma();
    const profile = await prisma.profile.findFirst({
      where: { userId: session.user.id },
      include: { socialActor: true },
    });
    viewerActorId = profile?.socialActor?.id;
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get('cursor') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const includeReplies = searchParams.get('replies') === 'true';

  const result = await getActorPosts(
    actor.id,
    viewerActorId,
    cursor,
    limit,
    includeReplies
  );

  return NextResponse.json({
    success: true,
    data: result,
  });
}
