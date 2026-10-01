/**
 * GET    /api/social/dm-requests - list senders waiting in the Requests folder
 * PATCH  /api/social/dm-requests - accept a request, creating the thread
 * DELETE /api/social/dm-requests - delete a request without replying
 *
 * The folder exists because DMs default to `everyone`. A thread opened by
 * somebody who is not a Pana is held here and rings nobody's phone; the
 * recipient triages on their own schedule. See docs/SOCIAL-GRAPH.md section C1.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import {
  acceptDirectThreadRequest,
  deleteDirectThreadRequest,
  listDirectThreadRequests,
} from '@/lib/federation';
import { db } from '@/lib/db';
import { socialActors, PUBLIC_ACTOR_COLUMNS } from '@/lib/schema';
import { inArray } from 'drizzle-orm';

async function requireActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const profile = await getActiveProfileWithActor(session.user.id);
  return profile?.socialActor ?? null;
}

export async function GET() {
  const actor = await requireActor();
  if (!actor) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const requests = await listDirectThreadRequests(actor.id);
  if (requests.length === 0) {
    return NextResponse.json({ success: true, data: { requests: [] } });
  }

  const senders = await db.query.socialActors.findMany({
    where: inArray(
      socialActors.id,
      requests.map((r) => r.senderActorId)
    ),
    columns: PUBLIC_ACTOR_COLUMNS,
  });
  const byId = new Map(senders.map((s) => [s.id, s]));

  return NextResponse.json({
    success: true,
    data: {
      requests: requests
        .map((r) => ({
          sender: byId.get(r.senderActorId),
          requestedAt: r.createdAt,
        }))
        .filter((r) => r.sender),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const actor = await requireActor();
  if (!actor) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { senderActorId } = await request.json();
  if (typeof senderActorId !== 'string' || !senderActorId) {
    return NextResponse.json(
      { success: false, error: 'senderActorId is required' },
      { status: 400 }
    );
  }

  const accepted = await acceptDirectThreadRequest(actor.id, senderActorId);
  if (!accepted) {
    return NextResponse.json(
      { success: false, error: 'No pending request from that account' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const actor = await requireActor();
  if (!actor) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { senderActorId } = await request.json();
  if (typeof senderActorId !== 'string' || !senderActorId) {
    return NextResponse.json(
      { success: false, error: 'senderActorId is required' },
      { status: 400 }
    );
  }

  const deleted = await deleteDirectThreadRequest(actor.id, senderActorId);
  if (!deleted) {
    return NextResponse.json(
      { success: false, error: 'No pending request from that account' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
