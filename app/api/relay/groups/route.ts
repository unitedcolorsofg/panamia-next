import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { relayGroups, relayGroupMembers } from '@/lib/schema';
import type { RelayGroupJoinPolicy } from '@/lib/schema';
import {
  discoverableFor,
  mintGroupId,
  isValidGroupId,
} from '@/lib/relay/group-lifecycle';
import {
  getCallerPubkey,
  listGroupsForPubkey,
  listPendingInvites,
} from '@/lib/server/relay-groups';

// Member-facing group collection.
//
//   GET  — the caller's groups plus any invitations awaiting an answer.
//   POST — create a group. The creator is its first member, so a new group is
//          never born empty (which would make it eligible for immediate
//          delete-when-empty).
//
// Enrollment is the gate on both: group membership is keyed by Nostr pubkey,
// so an account without one has nothing to be a member of. GET answers 200
// with empty groups + live invites in that case rather than 412 — an
// unenrolled member still needs to see invitations, since seeing one is the
// reason to go enroll.

const NAME_MAX = 80;
const ABOUT_MAX = 500;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'sign-in required' }, { status: 401 });
  }

  const pubkey = await getCallerPubkey(session.user.id);
  const [groups, invites] = await Promise.all([
    pubkey ? listGroupsForPubkey(pubkey) : Promise.resolve([]),
    listPendingInvites(session.user.id),
  ]);

  return NextResponse.json({ enrolled: pubkey !== null, groups, invites });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'sign-in required' }, { status: 401 });
  }

  const pubkey = await getCallerPubkey(session.user.id);
  if (!pubkey) {
    return NextResponse.json({ error: 'enrollment_required' }, { status: 412 });
  }

  let body: { name?: string; about?: string; joinPolicy?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length > NAME_MAX) {
    return NextResponse.json(
      { error: `name is required and must be at most ${NAME_MAX} characters` },
      { status: 400 }
    );
  }

  const about = body.about?.trim() || null;
  if (about && about.length > ABOUT_MAX) {
    return NextResponse.json(
      { error: `about must be at most ${ABOUT_MAX} characters` },
      { status: 400 }
    );
  }

  if (body.joinPolicy !== 'invite_only' && body.joinPolicy !== 'open') {
    return NextResponse.json(
      { error: "joinPolicy must be 'invite_only' or 'open'" },
      { status: 400 }
    );
  }
  const joinPolicy: RelayGroupJoinPolicy = body.joinPolicy;

  // The id is derived from the name, so a pathological name could in principle
  // produce something the relay's h-tag validator rejects. mintGroupId already
  // constrains the alphabet; this asserts it rather than trusting it.
  const groupId = mintGroupId(name);
  if (!isValidGroupId(groupId)) {
    return NextResponse.json(
      { error: 'could not derive a valid group id from that name' },
      { status: 400 }
    );
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(relayGroups).values({
        groupId,
        name,
        about,
        createdBy: pubkey,
        joinPolicy,
        // Derived, never taken from the request: an open group is browsable
        // here and advertised by the relay; an invite-only group is neither.
        discoverable: discoverableFor(joinPolicy),
      });
      await tx.insert(relayGroupMembers).values({ groupId, pubkey });
    });
  } catch (err: unknown) {
    // The random suffix makes a primary-key collision vanishingly unlikely,
    // but it is a retry the caller can make rather than a server fault.
    const message = err instanceof Error ? err.message : String(err);
    if (/duplicate key/i.test(message)) {
      return NextResponse.json(
        { error: 'group id collision, please try again' },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true, groupId }, { status: 201 });
}
