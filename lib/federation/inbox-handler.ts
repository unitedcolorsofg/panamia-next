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
import { SocialActor } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
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
    default:
      // Accept but ignore other activity types for POC
      return NextResponse.json({ status: 'accepted' }, { status: 202 });
  }
}

/**
 * Handle an incoming Follow activity.
 *
 * 1. Upsert the remote actor
 * 2. Create a SocialFollow record (accepted)
 * 3. Send an Accept activity back (fire-and-forget)
 *
 * Follow handling ported from external/activities.next/app/api/users/[username]/inbox/route.ts
 * Accept activity format ported from external/activities.next/lib/activities/index.ts
 * acceptFollow() (lines 501–553)
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

  const prisma = await getPrisma();

  // Check for existing follow
  const existing = await prisma.socialFollow.findUnique({
    where: {
      actorId_targetActorId: {
        actorId: remoteActor.id,
        targetActorId: targetActor.id,
      },
    },
  });

  if (!existing) {
    // Create follow (immediately accepted for POC)
    const follow = await prisma.socialFollow.create({
      data: {
        actorId: remoteActor.id,
        targetActorId: targetActor.id,
        status: 'accepted',
        acceptedAt: new Date(),
        uri: activity.id,
      },
    });

    // Update follower counts
    await Promise.all([
      prisma.socialActor.update({
        where: { id: remoteActor.id },
        data: { followingCount: { increment: 1 } },
      }),
      prisma.socialActor.update({
        where: { id: targetActor.id },
        data: { followersCount: { increment: 1 } },
      }),
    ]);
  }

  // Send Accept back (fire-and-forget)
  // Ported from external/activities.next/lib/activities/index.ts acceptFollow() (lines 515–542)
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
 * Send an Accept activity in response to a Follow.
 *
 * Ported from external/activities.next/lib/activities/index.ts
 * acceptFollow() (lines 501–553)
 * Changes: uses native fetch instead of got/request
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
