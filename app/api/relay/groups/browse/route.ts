import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCallerPubkey, listOpenGroups } from '@/lib/server/relay-groups';

// Groups open to all panas that the caller has not already joined.
//
// Invite-only groups never appear here. `discoverable` is derived from the
// same join_policy the relay uses to decide whether to emit public kind-39000
// metadata, so this listing and what a Nostr client can discover stay in
// agreement — a group is either publicly known in both places or neither.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'sign-in required' }, { status: 401 });
  }

  const pubkey = await getCallerPubkey(session.user.id);
  const groups = await listOpenGroups(pubkey);

  return NextResponse.json({ enrolled: pubkey !== null, groups });
}

export const maxDuration = 5;
