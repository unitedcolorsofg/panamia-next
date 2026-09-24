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

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get('cursor') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  // Replies inside a private group are readable by members only, so the
  // viewer has to be resolved here even though this is a public endpoint.
  let viewerActorId: string | undefined;
  const session = await auth();
  if (session?.user?.id) {
    const profile = await getActiveProfileWithActor(session.user.id);
    viewerActorId = profile?.socialActor?.id;
  }

  const result = await getStatusReplies(statusId, cursor, limit, viewerActorId);

  return NextResponse.json({
    success: true,
    data: result,
  });
}
