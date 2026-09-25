/**
 * GET /api/social/actors/[username]/stories - A pana's live stories
 *
 * Called from the client on profile mount, never server-rendered: the profile
 * page is edge-cached for five minutes and shared across visitors, so a
 * response containing this viewer's `seen` flags would be handed to everyone
 * who loaded the page next.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { getActiveStories } from '@/lib/federation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  let viewerActorId: string | undefined;
  const session = await auth();
  if (session?.user?.id) {
    const profile = await getActiveProfileWithActor(session.user.id);
    viewerActorId = profile?.socialActor?.id;
  }

  const tray = await getActiveStories(username, viewerActorId);

  if (!tray) {
    return NextResponse.json(
      { success: false, error: 'Actor not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { success: true, data: tray },
    {
      // Never cached at the edge. The payload is viewer-specific (`seen`,
      // `viewCount`) and changes the moment a story is posted or expires.
      headers: { 'Cache-Control': 'private, no-store' },
    }
  );
}
