import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  profiles,
  relayGroups,
  relayGroupMembers,
  relayGroupInvites,
} from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';
import { isValidGroupId } from '@/lib/relay/group-lifecycle';
import { maturedLeaveExists } from '@/lib/relay/group-maturation';
import {
  INVITE_TTL_DAYS,
  findInviteeByScreenname,
  getCallerPubkey,
} from '@/lib/server/relay-groups';
import { createNotification } from '@/lib/notifications';

// Invite a Pana member to a group, by screenname.
//
// Who may invite: whoever holds creator rights for an invite-only group. Open
// groups accept an invite from any member — the group is joinable by anyone
// already, so a "come join us" nudge from a member gives away nothing that
// /r/groups/browse does not.
//
// The invitee need not be enrolled. The invitation is delivered to their Pana
// account through the notifications table, and seeing one is a reason to go
// enroll; the enrollment check happens at accept time instead.
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
  const inviterUserId = session.user.id;

  const pubkey = await getCallerPubkey(inviterUserId);
  if (!pubkey) {
    return NextResponse.json({ error: 'enrollment_required' }, { status: 412 });
  }

  let body: { screenname?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const screenname = body.screenname?.trim().replace(/^@/, '');
  if (!screenname) {
    return NextResponse.json(
      { error: 'screenname is required' },
      { status: 400 }
    );
  }

  const [group] = await db
    .select({
      name: relayGroups.name,
      createdBy: relayGroups.createdBy,
      joinPolicy: relayGroups.joinPolicy,
    })
    .from(relayGroups)
    .where(eq(relayGroups.groupId, groupId))
    .limit(1);

  if (!group) {
    return NextResponse.json({ error: 'group not found' }, { status: 404 });
  }

  const [membership] = await db
    .select({ exists: sql<number>`1` })
    .from(relayGroupMembers)
    .where(
      and(
        eq(relayGroupMembers.groupId, groupId),
        eq(relayGroupMembers.pubkey, pubkey),
        sql`NOT EXISTS (${maturedLeaveExists})`
      )
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: 'group not found' }, { status: 404 });
  }

  const mayInvite = group.joinPolicy === 'open' || group.createdBy === pubkey;
  if (!mayInvite) {
    return NextResponse.json({ error: 'not permitted' }, { status: 403 });
  }

  const invitee = await findInviteeByScreenname(screenname);
  if (!invitee) {
    return NextResponse.json(
      { error: 'no member with that screenname' },
      { status: 404 }
    );
  }
  if (invitee.userId === inviterUserId) {
    return NextResponse.json(
      { error: 'you are already in this group' },
      { status: 400 }
    );
  }

  // Already a member? Their pubkey — if they have one — is in the roster.
  const [inviteeProfile] = await db
    .select({ nostrPubkey: profiles.nostrPubkey })
    .from(profiles)
    .where(eq(profiles.userId, invitee.userId))
    .limit(1);

  if (inviteeProfile?.nostrPubkey) {
    const [already] = await db
      .select({ exists: sql<number>`1` })
      .from(relayGroupMembers)
      .where(
        and(
          eq(relayGroupMembers.groupId, groupId),
          eq(relayGroupMembers.pubkey, inviteeProfile.nostrPubkey),
          sql`NOT EXISTS (${maturedLeaveExists})`
        )
      )
      .limit(1);
    if (already) {
      return NextResponse.json(
        { error: 'that member is already in this group' },
        { status: 409 }
      );
    }
  }

  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  // Re-inviting refreshes the expiry rather than stacking a second row, so a
  // nudge after three weeks of silence works without creating duplicates.
  const [invite] = await db
    .insert(relayGroupInvites)
    .values({
      groupId,
      invitedUserId: invitee.userId,
      invitedByUserId: inviterUserId,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [relayGroupInvites.groupId, relayGroupInvites.invitedUserId],
      set: { expiresAt, invitedByUserId: inviterUserId },
    })
    .returning({ id: relayGroupInvites.id });

  await createNotification({
    type: 'Invite',
    actorId: inviterUserId,
    targetId: invitee.userId,
    context: 'group',
    objectId: groupId,
    objectType: 'group',
    objectTitle: group.name,
    objectUrl: `/r/groups/${groupId}`,
  });

  return NextResponse.json({
    ok: true,
    inviteId: invite.id,
    screenname: invitee.screenname,
    expiresAt,
  });
}
