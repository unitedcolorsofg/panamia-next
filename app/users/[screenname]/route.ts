/**
 * ActivityPub Actor Endpoint
 *
 * Returns the ActivityPub actor representation for a user.
 * This is fetched by other servers when they want to know
 * about a user on panamia.club.
 *
 * @see https://www.w3.org/TR/activitypub/#actor-objects
 * @see https://docs.joinmastodon.org/spec/activitypub/#actors
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActorByScreenname } from '@/lib/federation/wrappers/actor';
import { formatPublicKeyForActor } from '@/lib/federation/crypto/keys';
import { socialConfig } from '@/lib/federation';
import { getPrisma } from '@/lib/prisma';

const ACTIVITY_JSON_TYPES = [
  'application/activity+json',
  'application/ld+json',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ screenname: string }> }
) {
  const { screenname } = await params;

  // Check Accept header - only respond with ActivityPub if requested
  const accept = request.headers.get('accept') || '';
  const wantsActivityPub = ACTIVITY_JSON_TYPES.some((type) =>
    accept.includes(type)
  );

  // If not requesting ActivityPub, redirect to profile page
  if (!wantsActivityPub) {
    return NextResponse.redirect(
      new URL(`/profile/${screenname}`, request.url)
    );
  }

  // Look up the actor
  const actor = await getActorByScreenname(screenname);

  if (!actor) {
    // Check if this is a historical screenname (user changed their screenname)
    const prisma = await getPrisma();
    const historical = await prisma.screennameHistory.findFirst({
      where: { screenname: { equals: screenname, mode: 'insensitive' } },
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
    url: `https://${socialConfig.domain}/profile/${actor.username}`,
    inbox: actor.inboxUrl,
    outbox: actor.outboxUrl,
    followers: actor.followersUrl,
    following: actor.followingUrl,
    publicKey: formatPublicKeyForActor(actor.uri, actor.publicKey),
    icon: actor.iconUrl
      ? {
          type: 'Image',
          mediaType: 'image/jpeg', // Could be smarter about this
          url: actor.iconUrl,
        }
      : undefined,
    manuallyApprovesFollowers: actor.manuallyApprovesFollowers,
    published: actor.createdAt.toISOString(),
    // Mastodon-specific extensions
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
