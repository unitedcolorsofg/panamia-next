/**
 * GET /api/social/actors/[username]/panas - Panas (mutual follows)
 *
 * Panas are mutual follows, and the two halves of this response have different
 * audiences on purpose:
 *
 *   count  — public. It is an aggregate, and every person inside it chose the
 *            connection from both sides, so it reveals nothing one party can
 *            impose on another.
 *   actors — signed-in viewers only. Naming who someone is connected to is a
 *            different disclosure from saying how many, and it is the one that
 *            maps a social graph for anyone who asks.
 *
 * This is narrower than /api/social/follows, which only ever answers about the
 * caller's own graph and therefore cannot serve another profile's page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getActorByScreenname,
  countMutualFollows,
  listMutualFollows,
} from '@/lib/federation';

export async function GET(
  _request: NextRequest,
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

  const session = await auth();
  const canSeeList = Boolean(session?.user?.id);

  // The count is computed either way; only the list is conditional.
  const [count, actors] = await Promise.all([
    countMutualFollows(actor.id),
    canSeeList ? listMutualFollows(actor.id) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      count,
      canSeeList,
      actors: actors.map((a) => ({
        id: a.id,
        username: a.username,
        domain: a.domain,
        name: a.name,
        summary: a.summary,
        iconUrl: a.iconUrl,
      })),
    },
  });
}
