/**
 * GET /api/social/groups/[handle]/members - Read a group's roster
 *
 * Returns two lists with deliberately different gates.
 *
 * `members` is the roster, and it is the sensitive one. A private group's
 * roster is a list of people who joined something they expected to be
 * private, so it is withheld from anyone who is not an active member. This is
 * the same rule the detail route computes for `canRead`, written the same way
 * on purpose -- see the note there about re-deriving a rule being how it ends
 * up subtly different in one place.
 *
 * `leaders` is NOT gated, and that is a considered disclosure rather than an
 * oversight. A locked-out viewer of a private group learns which actors run
 * it. The alternative is a page whose only available action is "ask to join"
 * with nobody named to ask, which is a dead end nobody knocks on. The mock
 * makes the same call: its locked state keeps "Admins & mods" and drops the
 * posts, the roster, the event location and the counts.
 *
 * `total` is likewise ungated, matching the detail route, which already
 * returns member_count to a stranger. Withholding it here while publishing it
 * there would not protect anything, it would just make the card render "0
 * members" on a group the same client was told has 40.
 *
 * @see docs/GROUPS-ROADMAP.md
 * @see app/mock/group
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import {
  getGroupByHandle,
  getMembership,
  listBannedMembers,
  listGroupLeaders,
  listGroupMembers,
  listPendingRequests,
  MAX_ROSTER_PAGE,
} from '@/lib/federation';

/**
 * Read a positive integer from the query string, or fall back.
 *
 * Anything unparseable becomes the fallback rather than a 400: a roster is a
 * read, and failing the whole page because a stray ?offset=abc rode in on a
 * link is a worse outcome than showing the first page.
 */
function readInt(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const found = await getGroupByHandle(handle);
  if (!found) {
    return NextResponse.json(
      { success: false, error: 'Group not found' },
      { status: 404 }
    );
  }

  const { group } = found;

  // Unauthenticated readers are a viewer with no membership, not an error --
  // a public group's roster is readable by anyone, signed in or not.
  const session = await auth();
  const profile = session?.user?.id
    ? await getActiveProfileWithActor(session.user.id)
    : null;
  const viewerActorId = profile?.socialActor?.id ?? null;

  const membership = viewerActorId
    ? await getMembership(group.id, viewerActorId)
    : null;
  const isActiveMember = membership?.status === 'active';
  const canRead = group.visibility === 'public' || isActiveMember;

  const leaders = await listGroupLeaders(group.id);

  if (!canRead) {
    return NextResponse.json({
      success: true,
      data: {
        canRead: false,
        leaders,
        members: [],
        total: group.memberCount,
        nextOffset: null,
      },
    });
  }

  // No limit named means the caller wants the server's default, which
  // listGroupMembers supplies. Passing undefined keeps that one decision in
  // one place rather than mirroring the number here.
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit =
    limitParam === null
      ? undefined
      : Math.min(readInt(limitParam, 0) || 1, MAX_ROSTER_PAGE);
  const offset = readInt(request.nextUrl.searchParams.get('offset'), 0);

  const page = await listGroupMembers(group.id, { limit, offset });

  /* The moderation queues ride along with the roster rather than sitting on
     their own endpoint, because the only screen that wants them is the one
     already asking for this. A member gets neither: pending tells them who is
     waiting at the door, banned tells them who was thrown out, and neither is
     theirs to know.

     Only sent on the first page. They are unpaginated lists that do not change
     as you page through the roster, and re-sending them with every "Load more"
     would be the same bytes again for no reason. */
  const isLeader =
    membership?.status === 'active' &&
    (membership.role === 'admin' || membership.role === 'moderator');

  const queues =
    isLeader && offset === 0
      ? {
          pending: await listPendingRequests(group.id),
          banned: await listBannedMembers(group.id),
        }
      : {};

  return NextResponse.json({
    success: true,
    data: {
      canRead: true,
      leaders,
      viewerRole: membership?.status === 'active' ? membership.role : null,
      /* Which roster row is the viewer's own. The client needs this to refuse
         to offer "remove" on yourself, and it cannot work it out from the
         roster alone -- that is paged, and an admin can easily be on page 3. */
      viewerMemberId: membership?.id ?? null,
      ...queues,
      ...page,
    },
  });
}
