/**
 * POST /api/social/stories/[statusId]/view - Mark a story watched
 *
 * Fired by the viewer on every advance, including backwards, so it has to be
 * idempotent. markStoryViewed() relies on the unique index for that.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { markStoryViewed } from '@/lib/federation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ statusId: string }> }
) {
  const session = await auth();

  // Signed-out visitors can watch stories, there is just nowhere to record it.
  // Succeeding quietly keeps the viewer from having to special-case them.
  if (!session?.user?.id) {
    return NextResponse.json({ success: true, data: { recorded: false } });
  }

  const profile = await getActiveProfileWithActor(session.user.id);
  if (!profile?.socialActor) {
    return NextResponse.json({ success: true, data: { recorded: false } });
  }

  const { statusId } = await params;
  const result = await markStoryViewed(statusId, profile.socialActor.id);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: { recorded: true } });
}
