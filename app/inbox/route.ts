/**
 * Shared ActivityPub Inbox
 *
 * POST endpoint that receives activities not addressed to a specific actor.
 * Some servers send Follow requests here instead of the per-actor inbox.
 *
 * Ported from external/activities.next/app/api/inbox/route.ts
 * Simplified: extracts target actor from activity.object, then delegates
 * to the same handler as the per-actor inbox.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActorByUri } from '@/lib/federation/wrappers/actor';
import { handleInboxPost } from '@/lib/federation/inbox-handler';

export async function POST(request: NextRequest) {
  // We need to clone the request so we can read the body twice
  // (once here to extract the target, once in handleInboxPost)
  const body = await request.text();

  let activity: { type?: string; object?: string | { id?: string } };
  try {
    activity = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!activity.type) {
    return NextResponse.json(
      { error: 'Missing activity type' },
      { status: 400 }
    );
  }

  // Extract the target actor URI from the activity object
  const objectUri =
    typeof activity.object === 'string' ? activity.object : activity.object?.id;

  if (!objectUri) {
    return NextResponse.json(
      { error: 'Cannot determine target actor' },
      { status: 400 }
    );
  }

  // Look up the local actor
  const targetActor = await getActorByUri(objectUri);
  if (!targetActor) {
    return NextResponse.json(
      { error: 'Target actor not found' },
      { status: 404 }
    );
  }

  // Reconstruct a request with the body we already consumed
  const reconstructed = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  });

  return handleInboxPost(reconstructed, targetActor);
}
