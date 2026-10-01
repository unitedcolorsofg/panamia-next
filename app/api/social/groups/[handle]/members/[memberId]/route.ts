/**
 * PATCH /api/social/groups/[handle]/members/[memberId] - Act on a membership
 *
 * One endpoint, an explicit action verb in the body. The alternative -- a
 * PATCH that takes `{ role }` or `{ status }` and infers the intent -- makes
 * "remove" and "ban" the same request with a different field, and those are
 * the two that most need telling apart in a log.
 *
 * Every rule about who may do what lives in the wrapper, not here. This route
 * confirms there is a signed-in actor with an actor record and hands both ids
 * to the function, which answers with its own status code. That keeps the
 * authorization in the same file as the invariants it protects, rather than
 * split across a gate here and a guard there.
 *
 * `memberId` is the membership row's id, not the actor's. The row is what the
 * action targets, and it is what the roster already hands the client.
 *
 * @see lib/federation/wrappers/group-moderation.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import {
  approveRequest,
  banMember,
  getGroupByHandle,
  rejectRequest,
  removeMember,
  setMemberRole,
  unbanMember,
  type ModerationResult,
} from '@/lib/federation';
import type { SocialGroupRole } from '@/lib/schema';

const ACTIONS = [
  'approve',
  'reject',
  'setRole',
  'remove',
  'ban',
  'unban',
] as const;

type Action = (typeof ACTIONS)[number];

const ROLES: SocialGroupRole[] = ['admin', 'moderator', 'member'];

function isAction(value: unknown): value is Action {
  return typeof value === 'string' && ACTIONS.includes(value as Action);
}

function isRole(value: unknown): value is SocialGroupRole {
  return typeof value === 'string' && ROLES.includes(value as SocialGroupRole);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string; memberId: string }> }
) {
  const { handle, memberId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const found = await getGroupByHandle(handle);
  if (!found) {
    return NextResponse.json(
      { success: false, error: 'Group not found' },
      { status: 404 }
    );
  }

  const profile = await getActiveProfileWithActor(session.user.id);
  const actorId = profile?.socialActor?.id;
  if (!actorId) {
    return NextResponse.json(
      { success: false, error: 'You need a Pana Social profile to do this' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Expected a JSON body' },
      { status: 400 }
    );
  }

  const { action, role } = (body ?? {}) as { action?: unknown; role?: unknown };

  if (!isAction(action)) {
    return NextResponse.json(
      { success: false, error: `Expected one of: ${ACTIONS.join(', ')}` },
      { status: 400 }
    );
  }

  const groupId = found.group.id;
  let result: ModerationResult;

  switch (action) {
    case 'approve':
      result = await approveRequest(groupId, actorId, memberId);
      break;
    case 'reject':
      result = await rejectRequest(groupId, actorId, memberId);
      break;
    case 'setRole':
      if (!isRole(role)) {
        return NextResponse.json(
          { success: false, error: `Expected a role: ${ROLES.join(', ')}` },
          { status: 400 }
        );
      }
      result = await setMemberRole(groupId, actorId, memberId, role);
      break;
    case 'remove':
      result = await removeMember(groupId, actorId, memberId);
      break;
    case 'ban':
      result = await banMember(groupId, actorId, memberId);
      break;
    case 'unban':
      result = await unbanMember(groupId, actorId, memberId);
      break;
  }

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    data: { membership: result.membership },
  });
}
