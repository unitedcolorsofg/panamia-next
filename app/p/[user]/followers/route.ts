/**
 * ActivityPub Followers Collection
 *
 * Returns an OrderedCollection with the follower count for an actor.
 * Mastodon checks this after sending a Follow request.
 *
 * Ported from external/activities.next/app/api/users/[username]/followers/route.ts
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
      id: actor.followersUrl,
      type: 'OrderedCollection',
      totalItems: actor.followersCount,
    },
    {
      headers: {
        'Content-Type': 'application/activity+json; charset=utf-8',
      },
    }
  );
}
