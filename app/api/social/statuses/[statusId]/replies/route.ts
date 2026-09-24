/**
 * GET /api/social/statuses/[statusId]/replies - Get replies to a status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { getStatusReplies } from '@/lib/federation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ statusId: string }> }
) {
  const { statusId } = await params;

  // Get viewer's actor if authenticated. Anonymous callers see public replies.
  let viewerActorId: string | undefined;
  const session = await auth();

  if (session?.user?.id) {
    const profile = await getActiveProfileWithActor(session.user.id);
    viewerActorId = profile?.socialActor?.id;
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get('cursor') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  const result = await getStatusReplies(statusId, viewerActorId, cursor, limit);

  return NextResponse.json({
    success: true,
    data: result,
  });
}
