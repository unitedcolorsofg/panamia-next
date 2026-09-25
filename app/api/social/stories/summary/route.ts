/**
 * GET /api/social/stories/summary?usernames=a,b,c - ring state for many panas
 *
 * The list-and-feed counterpart to /api/social/actors/[username]/stories.
 * That route returns a full tray for one pana and is right for a profile
 * page; drawing rings down a feed needs the opposite shape -- almost no data
 * about a lot of people. A caller asks once for everyone visible and fetches
 * the real tray only when someone taps.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { getStorySummaries } from '@/lib/federation';

/**
 * Cap on one request. Above this the caller is either paginating wrong or
 * probing, and either way the query stops being cheap.
 */
const MAX_USERNAMES = 100;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('usernames') ?? '';
  const usernames = raw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, MAX_USERNAMES);

  if (usernames.length === 0) {
    return NextResponse.json({ success: true, data: {} });
  }

  let viewerActorId: string | undefined;
  const session = await auth();
  if (session?.user?.id) {
    const profile = await getActiveProfileWithActor(session.user.id);
    viewerActorId = profile?.socialActor?.id;
  }

  const data = await getStorySummaries(usernames, viewerActorId);

  return NextResponse.json(
    { success: true, data },
    {
      // Viewer-specific (`hasUnseen`, `isOwner`) and goes stale the moment a
      // story is posted, watched or expires.
      headers: { 'Cache-Control': 'private, no-store' },
    }
  );
}
