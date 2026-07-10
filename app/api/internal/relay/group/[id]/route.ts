import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { relayGroups, relayGroupMembers } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { matureGroupLeaves } from '@/lib/relay/group-maturation';

// Full group state for NIP-29 metadata emission. Called by panamia-nosflare
// when it needs to materialize a fresh signed kind 39000/39001/39002.
//
// Maturation runs first — any pending leave older than the debounce window
// is applied to relay_group_members before the read, so the relay never
// sees a ghost-member who has technically left but hasn't been swept up.
//
// Reached only via Cloudflare Service Binding from panamia-nosflare. Returns
// 404 for unknown group ids — the relay treats this as "no metadata to emit",
// not an error.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || id.length > 128 || !/^[a-zA-Z0-9_.\-:]+$/.test(id)) {
    return NextResponse.json({ error: 'invalid group id' }, { status: 400 });
  }

  await matureGroupLeaves(db, id);

  const [group] = await db
    .select()
    .from(relayGroups)
    .where(eq(relayGroups.groupId, id))
    .limit(1);

  if (!group) {
    return NextResponse.json({ error: 'group not found' }, { status: 404 });
  }

  const members = await db
    .select({
      pubkey: relayGroupMembers.pubkey,
      joinedAt: relayGroupMembers.joinedAt,
    })
    .from(relayGroupMembers)
    .where(eq(relayGroupMembers.groupId, id));

  return NextResponse.json({
    groupId: group.groupId,
    name: group.name,
    about: group.about,
    picture: group.picture,
    discoverable: group.discoverable,
    // joinedAt as epoch seconds — relay uses it as `created_at` on the
    // synthesized kind 9000 "put-user" event, giving stable event ids so
    // re-emission dedupes via the events table primary key.
    members: members.map((m) => ({
      pubkey: m.pubkey,
      joinedAt: Math.floor(m.joinedAt.getTime() / 1000),
    })),
  });
}

export const maxDuration = 5;
