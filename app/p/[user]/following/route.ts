/**
 * ActivityPub Following Collection
 *
 * Returns an OrderedCollection with the following count for an actor.
 *
 * Ported from external/activities.next/app/api/users/[username]/following/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActorByScreenname } from '@/lib/federation/wrappers/actor';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user: string }> }
) {
  const { user } = await params;

  const actor = await getActorByScreenname(user);
  if (!actor) {
    return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: actor.followingUrl,
      type: 'OrderedCollection',
      totalItems: actor.followingCount,
    },
    {
      headers: {
        'Content-Type': 'application/activity+json; charset=utf-8',
      },
    }
  );
}
