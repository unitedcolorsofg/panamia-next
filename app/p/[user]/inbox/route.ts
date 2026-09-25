/**
 * Per-Actor ActivityPub Inbox
 *
 * POST endpoint that receives activities addressed to a specific actor.
 * Mastodon sends Follow requests here.
 *
 * Ported from external/activities.next/app/api/users/[username]/inbox/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFederatedActor } from '@/lib/federation/wrappers/actor';
import { handleInboxPost } from '@/lib/federation/inbox-handler';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ user: string }> }
) {
  const { user } = await params;

  const actor = await getFederatedActor(user);
  if (!actor) {
    return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
  }

  return handleInboxPost(request, actor);
}
