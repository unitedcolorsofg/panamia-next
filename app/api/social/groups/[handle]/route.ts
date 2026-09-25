/**
 * GET /api/social/groups/[handle] - Read a group
 *
 * Returns the group, its actor, and what the viewer is allowed to do with it.
 *
 * `canRead` is the single answer every later phase must ask before serving a
 * group's posts, roster or events. It is computed here, once, rather than
 * re-derived per endpoint, because private-group leakage is the highest
 * severity risk in the design and re-deriving a rule is how it ends up
 * subtly different in one place.
 *
 * Note what is NOT gated: a private group still returns its name, summary,
 * topics, rules, join policy and member count to a stranger. That is
 * deliberate and matches the mock -- a private group you cannot identify at
 * all is a dead end nobody would ever ask to join. What is withheld is the
 * content, and none of it lives on this endpoint.
 *
 * @see docs/GROUPS-ROADMAP.md
 * @see app/mock/group
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { getGroupByHandle, getMembership } from '@/lib/federation';

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

  const { group, actor } = found;

  // Unauthenticated readers are simply a viewer with no membership, not an
  // error -- a public group is readable by anyone, logged in or not.
  const session = await auth();
  const profile = session?.user?.id
    ? await getActiveProfileWithActor(session.user.id)
    : null;
  const viewerActorId = profile?.socialActor?.id ?? null;

  const membership = viewerActorId
    ? await getMembership(group.id, viewerActorId)
    : null;

  const isActiveMember = membership?.status === 'active';

  return NextResponse.json({
    success: true,
    data: {
      group,
      actor,
      viewer: {
        // A public group is readable by everyone. A private one is readable
        // only by an active member -- pending and banned are not members yet
        // and not members any more, and neither may read.
        canRead: group.visibility === 'public' || isActiveMember,
        canPost: isActiveMember,
        isMember: isActiveMember,
        isPending: membership?.status === 'pending',
        role: isActiveMember ? membership.role : null,
        // Null rather than false when signed out, so a client can tell "you
        // cannot join" apart from "we do not know who you are yet".
        canJoin: viewerActorId
          ? !membership && group.joinPolicy !== 'invite'
          : null,
      },
    },
  });
}
