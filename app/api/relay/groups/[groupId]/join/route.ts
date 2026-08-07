import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  relayGroups,
  relayGroupMembers,
  relayGroupLeavePending,
} from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { isValidGroupId } from '@/lib/relay/group-lifecycle';
import { getCallerPubkey } from '@/lib/server/relay-groups';

// Join an open group in one click.
//
// Only join_policy = 'open' is reachable here. Invite-only groups answer 404,
// matching the read path in lib/server/relay-groups.ts rather than claiming to
// hide anything — group existence is readable from the relay today, so a 403
// would leak nothing a 404 protects. The two paths agree so a caller never
// sees a group it cannot then act on. Members reach those through an invite.
//
// This is NOT the NIP-29 kind-9021 path. An advisory arriving from a Nostr
// client goes to /api/internal/relay/group-event and lands in
// relay_group_join_pending for review; a web join into a group whose policy is
// literally "open to all panas" has nothing left to review, so it writes the
// membership row directly.
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

  const [group] = await db
    .select({ joinPolicy: relayGroups.joinPolicy })
    .from(relayGroups)
    .where(eq(relayGroups.groupId, groupId))
    .limit(1);

  if (!group || group.joinPolicy !== 'open') {
    return NextResponse.json({ error: 'group not found' }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    // Clear any pending leave first. Rejoining inside the debounce window is
    // the auto-grant case from the advisory path: the membership row was never
    // actually removed, so dropping the pending row is the whole operation.
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
  });

  return NextResponse.json({ ok: true });
}

export const maxDuration = 5;
