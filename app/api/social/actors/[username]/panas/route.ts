/**
 * GET /api/social/actors/[username]/panas - Panas (mutual follows)
 *
 * Two different questions, with two different answers.
 *
 * **This actor's Panas** — count and list — are owner-only. An earlier version
 * served the count publicly, on the reasoning that an aggregate of mutually-
 * chosen connections reveals nothing either party could impose on the other.
 * That argument is sound about *consent* and beside the point about *effect*: a
 * number rendered on a profile is read as a score, and scoring the people in a
 * small local network is how you turn a mutual follow from a relationship into
 * a ranking. Pana Mia is trying to help panas find each other, not rank each
 * other. See docs/SOCIAL-GRAPH.md.
 *
 * **Mutual Panas** — the overlap between this actor's Panas and the *viewer's*
 * — is returned to any signed-in visitor looking at someone else. It is not the
 * owner-only aggregate wearing a different hat: every actor in it is already a
 * Pana of the person asking, so it is drawn from the viewer's own graph and
 * names nobody they are not already connected to. It cannot be used to
 * enumerate this actor's Panas, only to recognize your own. For the owner it is
 * empty, because your Panas in common with yourself are just your Panas.
 *
 * What also stays public is the per-person "Pana" badge: a visitor can still
 * see that two specific people are connected, because that is the fact each of
 * them opted into. The aggregate is the part that only its owner needs.
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
  getSharedPanas,
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
     response shape stable; `canSeeList` is what the client branches on. The
     same applies to `mutualPanas`, which is empty for the owner and for a
     signed-out visitor — one has no overlap to compute, the other no graph. */
  const [count, actors, mutualPanas] = await Promise.all([
    isOwner ? countMutualFollows(actor.id) : Promise.resolve(0),
    isOwner ? listMutualFollows(actor.id) : Promise.resolve([]),
    viewerActorId && !isOwner
      ? getSharedPanas(viewerActorId, actor.id)
      : Promise.resolve({ count: 0, actors: [] }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      count,
      canSeeList: isOwner,
      actors: actors.map(toPanaSummary),
      mutualPanas: {
        count: mutualPanas.count,
        actors: mutualPanas.actors.map(toPanaSummary),
      },
    },
  });
}

function toPanaSummary(a: {
  id: string;
  username: string;
  domain: string;
  name: string | null;
  summary: string | null;
  iconUrl: string | null;
}) {
  return {
    id: a.id,
    username: a.username,
    domain: a.domain,
    name: a.name,
    summary: a.summary,
    iconUrl: a.iconUrl,
  };
}
