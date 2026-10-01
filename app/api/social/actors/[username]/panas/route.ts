/**
 * GET /api/social/actors/[username]/panas - Panas (mutual follows)
 *
 * Both halves are owner-only.
 *
 * An earlier version of this route served the count publicly, on the reasoning
 * that an aggregate of mutually-chosen connections reveals nothing either party
 * could impose on the other. That argument is sound about *consent* and beside
 * the point about *effect*: a number rendered on a profile is read as a score,
 * and scoring the people in a small local network is how you turn a mutual
 * follow from a relationship into a ranking. Pana Mia is trying to help panas
 * find each other, not rank each other. See docs/SOCIAL-GRAPH.md.
 *
 * What stays public is the per-person "Pana" badge: a visitor can still see
 * that two specific people are connected, because that is the fact each of them
 * opted into. The aggregate is the part that only its owner needs.
 *
 * This is narrower than /api/social/follows, which only ever answers about the
 * caller's own graph and therefore cannot serve another profile's page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
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

  /* Compared on actor id, the same test GET /api/social/actors/[username]
     uses for `isSelf`. Going through the viewer's active profile matters:
     one account can hold several profiles, and only the one currently
     switched into should read as "you". */
  const session = await auth();
  let viewerActorId: string | null = null;
  if (session?.user?.id) {
    const profile = await getActiveProfileWithActor(session.user.id);
    viewerActorId = profile?.socialActor?.id ?? null;
  }
  const isOwner = viewerActorId !== null && viewerActorId === actor.id;

  /* Returning zero to non-owners rather than omitting the field keeps the
     response shape stable; `canSeeList` is what the client branches on. */
  const [count, actors] = await Promise.all([
    isOwner ? countMutualFollows(actor.id) : Promise.resolve(0),
    isOwner ? listMutualFollows(actor.id) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      count,
      canSeeList: isOwner,
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
