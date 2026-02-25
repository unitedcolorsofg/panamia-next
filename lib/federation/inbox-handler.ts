/**
 * ActivityPub Inbox Handler
 *
 * Shared logic for processing inbound ActivityPub activities,
 * used by both the per-actor inbox and the shared inbox.
 *
 * Ported from external/activities.next/app/api/users/[username]/inbox/route.ts
 * (Follow handling) and external/activities.next/lib/activities/index.ts
 * (acceptFollow, lines 501–553).
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { socialFollows, socialActors } from '@/lib/schema';
import type { SocialActor } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';
import { verify } from './crypto/verify';
import { signedHeaders } from './crypto/sign';
import {
  resolveSignaturePublicKey,
  ensureRemoteActor,
} from './wrappers/remote-actor';

/** Minimal ActivityPub activity shape */
interface Activity {
  '@context'?: string | string[];
  id: string;
  type: string;
  actor: string;
  object:
    | string
    | { id?: string; type?: string; actor?: string; object?: string };
}

/**
 * Process an incoming ActivityPub activity for a target local actor.
 *
 * 1. Verifies HTTP Signature
 * 2. Dispatches by activity type
 */
export async function handleInboxPost(
  request: Request,
  targetActor: SocialActor
): Promise<NextResponse> {
  // Parse body
  let activity: Activity;
  try {
    activity = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!activity.type || !activity.actor) {
    return NextResponse.json(
      { error: 'Missing type or actor' },
      { status: 400 }
    );
  }

  // Verify HTTP Signature
  const signatureHeader = request.headers.get('signature');
  if (!signatureHeader) {
    return NextResponse.json(
      { error: 'Missing Signature header' },
      { status: 401 }
    );
  }

  const keyResult = await resolveSignaturePublicKey(signatureHeader);
  if (!keyResult) {
    return NextResponse.json(
      { error: 'Could not resolve signing key' },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const requestTarget = `post ${url.pathname}`;
  const verified = await verify(
    requestTarget,
    request.headers,
    keyResult.publicKey
  );
  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Dispatch by activity type
  switch (activity.type) {
    case 'Follow':
      return handleFollow(activity, targetActor);
    case 'Undo':
      return handleUndo(activity, targetActor);
    default:
      // Accept but ignore other activity types for POC
      return NextResponse.json({ status: 'accepted' }, { status: 202 });
  }
}

/**
 * Handle an incoming Follow activity.
 */
async function handleFollow(
  activity: Activity,
  targetActor: SocialActor
): Promise<NextResponse> {
  const followerActorUri =
    typeof activity.actor === 'string' ? activity.actor : '';
  if (!followerActorUri) {
    return NextResponse.json({ error: 'Invalid actor' }, { status: 400 });
  }

  // Ensure the remote actor exists in our DB
  const remoteActor = await ensureRemoteActor(followerActorUri);
  if (!remoteActor) {
    return NextResponse.json(
      { error: 'Could not resolve remote actor' },
      { status: 400 }
    );
  }

  // Check for existing follow
  const existing = await db.query.socialFollows.findFirst({
    where: and(
      eq(socialFollows.actorId, remoteActor.id),
      eq(socialFollows.targetActorId, targetActor.id)
    ),
  });

  if (!existing) {
    // Create follow (immediately accepted for POC)
    await db.insert(socialFollows).values({
      actorId: remoteActor.id,
      targetActorId: targetActor.id,
      status: 'accepted',
      acceptedAt: new Date(),
      uri: activity.id,
    });

    // Update follower counts
    await Promise.all([
      db
        .update(socialActors)
        .set({ followingCount: sql`${socialActors.followingCount} + 1` })
        .where(eq(socialActors.id, remoteActor.id)),
      db
        .update(socialActors)
        .set({ followersCount: sql`${socialActors.followersCount} + 1` })
        .where(eq(socialActors.id, targetActor.id)),
    ]);
  }

  // Send Accept back (fire-and-forget)
  sendAccept(targetActor, remoteActor, activity).catch((err) => {
    console.error('[handleFollow] Failed to send Accept:', err);
  });

  return NextResponse.json(
    {
      target:
        typeof activity.object === 'string'
          ? activity.object
          : activity.object?.id,
    },
    { status: 202 }
  );
}

/**
 * Handle an incoming Undo activity.
 */
async function handleUndo(
  activity: Activity,
  targetActor: SocialActor
): Promise<NextResponse> {
  const innerObject =
    typeof activity.object === 'string' ? null : activity.object;

  // Only handle Undo Follow for now
  if (!innerObject || innerObject.type !== 'Follow') {
    return NextResponse.json({ status: 'accepted' }, { status: 202 });
  }

  const remoteActorUri =
    typeof activity.actor === 'string' ? activity.actor : '';
  if (!remoteActorUri) {
    return NextResponse.json({ error: 'Invalid actor' }, { status: 400 });
  }

  const remoteActor = await ensureRemoteActor(remoteActorUri);
  if (!remoteActor) {
    return NextResponse.json({ status: 'accepted' }, { status: 202 });
  }

  // Find and delete the follow record
  const existingFollow = await db.query.socialFollows.findFirst({
    where: and(
      eq(socialFollows.actorId, remoteActor.id),
      eq(socialFollows.targetActorId, targetActor.id)
    ),
  });

  if (existingFollow) {
    await db
      .delete(socialFollows)
      .where(eq(socialFollows.id, existingFollow.id));

    // Decrement follow counts
    await Promise.all([
      db
        .update(socialActors)
        .set({ followingCount: sql`${socialActors.followingCount} - 1` })
        .where(eq(socialActors.id, remoteActor.id)),
      db
        .update(socialActors)
        .set({ followersCount: sql`${socialActors.followersCount} - 1` })
        .where(eq(socialActors.id, targetActor.id)),
    ]);
  }

  return NextResponse.json({ status: 'accepted' }, { status: 202 });
}

/**
 * Send an Accept activity in response to a Follow.
 */
async function sendAccept(
  localActor: SocialActor,
  remoteActor: SocialActor,
  followActivity: Activity
) {
  const acceptActivity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${localActor.uri}#accepts/followers`,
    type: 'Accept',
    actor: localActor.uri,
    object: {
      id: followActivity.id,
      type: 'Follow',
      actor:
        typeof followActivity.actor === 'string' ? followActivity.actor : '',
      object:
        typeof followActivity.object === 'string'
          ? followActivity.object
          : followActivity.object?.id || localActor.uri,
    },
  };

  const targetInbox = remoteActor.sharedInboxUrl || remoteActor.inboxUrl;
  const headers = signedHeaders(
    { id: localActor.uri, privateKey: localActor.privateKey },
    'post',
    targetInbox,
    acceptActivity
  );

  const response = await fetch(targetInbox, {
    method: 'POST',
    headers: {
      ...headers,
      Accept:
        'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
    },
    body: JSON.stringify(acceptActivity),
  });

  if (!response.ok) {
    console.error(
      `[sendAccept] Remote server returned ${response.status} for ${targetInbox}`
    );
  }
}
