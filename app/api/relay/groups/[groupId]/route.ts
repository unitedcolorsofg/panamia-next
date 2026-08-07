import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { relayGroups } from '@/lib/schema';
import type { RelayGroupJoinPolicy } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { discoverableFor, isValidGroupId } from '@/lib/relay/group-lifecycle';
import {
  getCallerPubkey,
  getGroupForPubkey,
  listGroupMembers,
} from '@/lib/server/relay-groups';

// One group: read its state, or edit its metadata.
//
//   GET   — group + roster. Members see any group they belong to; non-members
//           see open groups only, and without the roster. Invite-only groups
//           404 for outsiders — see getGroupForPubkey for why that is a
//           "nothing here for you" and not a claim of concealment.
//   PATCH — name, about, and join policy. Restricted to whoever currently
//           holds creator rights. Members never see that role named in the UI;
//           it exists so metadata edits have exactly one owner.
//
// There is no DELETE. A group ends when its last member leaves (see
// lib/relay/group-lifecycle.ts) — nobody can dissolve a group out from under
// members who are still in it.

const NAME_MAX = 80;
const ABOUT_MAX = 500;

export async function GET(
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
  const group = await getGroupForPubkey(groupId, pubkey);
  if (!group) {
    return NextResponse.json({ error: 'group not found' }, { status: 404 });
  }

  // The roster is members-only. An open group's card is public enough to show
  // a name, a blurb, and a headcount; who is inside it is not.
  const members = group.isMember ? await listGroupMembers(groupId, pubkey) : [];

  return NextResponse.json({ group, members });
}

export async function PATCH(
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

  const pubkey = await getCallerPubkey(session.user.id);
  if (!pubkey) {
    return NextResponse.json({ error: 'enrollment_required' }, { status: 412 });
  }

  const [group] = await db
    .select({ createdBy: relayGroups.createdBy })
    .from(relayGroups)
    .where(eq(relayGroups.groupId, groupId))
    .limit(1);

  if (!group) {
    return NextResponse.json({ error: 'group not found' }, { status: 404 });
  }
  if (group.createdBy !== pubkey) {
    // Includes the system-provisioned case (created_by NULL): panamia's own
    // groups are not member-editable.
    return NextResponse.json({ error: 'not permitted' }, { status: 403 });
  }

  let body: { name?: string; about?: string; joinPolicy?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const updates: {
    name?: string;
    about?: string | null;
    joinPolicy?: RelayGroupJoinPolicy;
    discoverable?: boolean;
  } = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name || name.length > NAME_MAX) {
      return NextResponse.json(
        { error: `name must be 1-${NAME_MAX} characters` },
        { status: 400 }
      );
    }
    // The group id is minted from the name at creation and never changes:
    // it is the NIP-29 h-tag every existing message in the group carries, so
    // rewriting it would orphan the group's history on the relay.
    updates.name = name;
  }

  if (body.about !== undefined) {
    const about = body.about.trim();
    if (about.length > ABOUT_MAX) {
      return NextResponse.json(
        { error: `about must be at most ${ABOUT_MAX} characters` },
        { status: 400 }
      );
    }
    updates.about = about || null;
  }

  if (body.joinPolicy !== undefined) {
    if (body.joinPolicy !== 'invite_only' && body.joinPolicy !== 'open') {
      return NextResponse.json(
        { error: "joinPolicy must be 'invite_only' or 'open'" },
        { status: 400 }
      );
    }
    updates.joinPolicy = body.joinPolicy;
    updates.discoverable = discoverableFor(body.joinPolicy);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  await db
    .update(relayGroups)
    .set(updates)
    .where(eq(relayGroups.groupId, groupId));

  return NextResponse.json({ ok: true });
}

export const maxDuration = 5;
