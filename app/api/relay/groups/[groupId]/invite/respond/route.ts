import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  relayGroupInvites,
  relayGroupMembers,
  relayGroupLeavePending,
} from '@/lib/schema';
import { and, eq, gt } from 'drizzle-orm';
import { isValidGroupId } from '@/lib/relay/group-lifecycle';
import { getCallerPubkey } from '@/lib/server/relay-groups';
import { createNotification } from '@/lib/notifications';

// Answer a group invitation: { action: 'accept' | 'decline' }.
//
// Either answer consumes the invite row. Declining leaves no trace beyond the
// notification sent back to the inviter — there is no "declined" state to
// browse, so a member who says no is not left on a list somewhere.
//
// Accepting requires enrollment, because acceptance writes a membership row
// keyed by Nostr pubkey and an unenrolled account has none. The invite stays
// live in that case (412, not consumed) so it is still waiting after they
// enroll.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  if (!isValidGroupId(groupId)) {
    return NextResponse.json({ error: 'invalid group id' }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'sign-in required' }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { action?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  if (body.action !== 'accept' && body.action !== 'decline') {
    return NextResponse.json(
      { error: "action must be 'accept' or 'decline'" },
      { status: 400 }
    );
  }

  const [invite] = await db
    .select({
      id: relayGroupInvites.id,
      invitedByUserId: relayGroupInvites.invitedByUserId,
    })
    .from(relayGroupInvites)
    .where(
      and(
        eq(relayGroupInvites.groupId, groupId),
        eq(relayGroupInvites.invitedUserId, userId),
        gt(relayGroupInvites.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!invite) {
    return NextResponse.json(
      { error: 'no live invitation to this group' },
      { status: 404 }
    );
  }

  if (body.action === 'decline') {
    await db
      .delete(relayGroupInvites)
      .where(eq(relayGroupInvites.id, invite.id));

    await createNotification({
      type: 'Reject',
      actorId: userId,
      targetId: invite.invitedByUserId,
      context: 'group',
      objectId: groupId,
      objectType: 'group',
      objectUrl: `/r/groups/${groupId}`,
    });

    return NextResponse.json({ ok: true, joined: false });
  }

  const pubkey = await getCallerPubkey(userId);
  if (!pubkey) {
    return NextResponse.json({ error: 'enrollment_required' }, { status: 412 });
  }

  await db.transaction(async (tx) => {
    // A pending leave from an earlier stint would otherwise mature later and
    // sweep the member straight back out of the group they just rejoined.
    await tx
      .delete(relayGroupLeavePending)
      .where(
        and(
          eq(relayGroupLeavePending.groupId, groupId),
          eq(relayGroupLeavePending.pubkey, pubkey)
        )
      );

    await tx
      .insert(relayGroupMembers)
      .values({ groupId, pubkey })
      .onConflictDoNothing();

    await tx
      .delete(relayGroupInvites)
      .where(eq(relayGroupInvites.id, invite.id));
  });

  await createNotification({
    type: 'Accept',
    actorId: userId,
    targetId: invite.invitedByUserId,
    context: 'group',
    objectId: groupId,
    objectType: 'group',
    objectUrl: `/r/groups/${groupId}`,
  });

  return NextResponse.json({ ok: true, joined: true });
}

export const maxDuration = 5;
