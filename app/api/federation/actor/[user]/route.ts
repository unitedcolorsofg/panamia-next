/**
 * ActivityPub Actor API Endpoint
 *
 * Internal route that returns the ActivityPub actor representation for a user.
 * Called via proxy.ts content negotiation when a remote server requests
 * /p/:screenname with an ActivityPub Accept header.
 *
 * @see https://www.w3.org/TR/activitypub/#actor-objects
 * @see https://docs.joinmastodon.org/spec/activitypub/#actors
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActorByScreenname } from '@/lib/federation/wrappers/actor';
import { formatPublicKeyForActor } from '@/lib/federation/crypto/keys';
import { socialConfig } from '@/lib/federation';
import { getPrisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user: string }> }
) {
  const { user } = await params;

  // Look up the actor
  const actor = await getActorByScreenname(user);

  if (!actor) {
    // Check if this is a historical screenname (user changed their screenname)
    const prisma = await getPrisma();
    const historical = await prisma.screennameHistory.findFirst({
      where: { screenname: { equals: user, mode: 'insensitive' } },
    });

    if (historical) {
      // Return 410 Gone - actor moved/deleted (ActivityPub standard)
      return new NextResponse(null, { status: 410 });
    }

    return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
  }

  // Build ActivityPub actor object
  const actorObject = {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: actor.uri,
    type: 'Person',
    preferredUsername: actor.username,
    name: actor.name || actor.username,
    summary: actor.summary || '',
    url: `https://${socialConfig.domain}/p/${actor.username}/`,
    inbox: actor.inboxUrl,
    outbox: actor.outboxUrl,
    followers: actor.followersUrl,
    following: actor.followingUrl,
    publicKey: formatPublicKeyForActor(actor.uri, actor.publicKey),
    icon: actor.iconUrl
      ? {
          type: 'Image',
          mediaType: 'image/jpeg',
          url: actor.iconUrl,
        }
      : undefined,
    image: {
      type: 'Image',
      mediaType: 'image/jpeg',
      url:
        actor.headerUrl ||
        `https://${socialConfig.domain}/img/federation/header.jpg`,
    },
    manuallyApprovesFollowers: actor.manuallyApprovesFollowers,
    published: actor.createdAt.toISOString(),
    discoverable: true,
    endpoints: {
      sharedInbox:
        actor.sharedInboxUrl || `https://${socialConfig.domain}/inbox`,
    },
  };

  return NextResponse.json(actorObject, {
    headers: {
      'Content-Type': 'application/activity+json; charset=utf-8',
      'Cache-Control': 'max-age=180',
    },
  });
}
