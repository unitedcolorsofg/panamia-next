import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  relayGroupMembers,
  relayGroupJoinPending,
  relayGroupLeavePending,
} from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';
import { LEAVE_DEBOUNCE_SECONDS } from '@/lib/relay/group-maturation';
import { isValidGroupId } from '@/lib/relay/group-lifecycle';
import { getCallerPubkey } from '@/lib/server/relay-groups';

// Leave a group from the web.
//
// Deliberately routed through the same 24h debounce as a kind-9022 advisory
// (see app/api/internal/relay/group-event/route.ts): the row lands in
// relay_group_leave_pending and matures later. Removing the membership row
// immediately here would make the web and Nostr paths disagree about the
// roster, and the relay reads that roster to decide who may read the group.
//
// Two consequences worth stating plainly, because the UI has to explain them:
//   - The caller keeps read access for the grace window. They have asked to
//     leave, not been removed.
//   - A group emptied by its last member is deleted when that leave matures,
//     not at the moment this returns.
export async function POST(
  _request: NextRequest,
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

  const pubkey = await getCallerPubkey(session.user.id);
  if (!pubkey) {
    return NextResponse.json({ error: 'enrollment_required' }, { status: 412 });
  }

  const result = await db.transaction(async (tx) => {
    await tx
      .delete(relayGroupJoinPending)
      .where(
        and(
          eq(relayGroupJoinPending.groupId, groupId),
          eq(relayGroupJoinPending.pubkey, pubkey)
        )
      );

    const [member] = await tx
      .select({ exists: sql<number>`1` })
      .from(relayGroupMembers)
      .where(
        and(
          eq(relayGroupMembers.groupId, groupId),
          eq(relayGroupMembers.pubkey, pubkey)
        )
      )
      .limit(1);

    if (!member) return { accepted: false as const };

    // ON CONFLICT DO NOTHING preserves the original requested_at: clicking
    // leave twice must not restart the clock.
    await tx
      .insert(relayGroupLeavePending)
      .values({ groupId, pubkey })
      .onConflictDoNothing();

    return { accepted: true as const };
  });

  if (!result.accepted) {
    return NextResponse.json({ error: 'not a member' }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    status: 'deferred',
    gracePeriodSeconds: LEAVE_DEBOUNCE_SECONDS,
  });
}

export const maxDuration = 5;
