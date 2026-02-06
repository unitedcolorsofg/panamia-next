/**
 * WebFinger Endpoint
 *
 * Implements RFC 7033 WebFinger for ActivityPub actor discovery.
 * When someone searches for @username@panamia.club, their server
 * queries this endpoint to find the actor's profile URL.
 *
 * @see https://tools.ietf.org/html/rfc7033
 * @see https://docs.joinmastodon.org/spec/webfinger/
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActorByScreenname } from '@/lib/federation/wrappers/actor';
import { socialConfig, getActorUrl } from '@/lib/federation';
import { getPrisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get('resource');

  if (!resource) {
    return NextResponse.json(
      { error: 'Missing resource parameter' },
      { status: 400 }
    );
  }

  // Parse acct:username@domain format
  const acctMatch = resource.match(/^acct:([^@]+)@(.+)$/);
  if (!acctMatch) {
    return NextResponse.json(
      { error: 'Invalid resource format. Expected acct:username@domain' },
      { status: 400 }
    );
  }

  const [, username, domain] = acctMatch;

  // Only respond for our domain
  if (domain !== socialConfig.domain) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  // Look up the actor
  const actor = await getActorByScreenname(username);

  if (!actor) {
    // Check if this is a historical screenname (user changed their screenname)
    const prisma = await getPrisma();
    const historical = await prisma.screennameHistory.findFirst({
      where: { screenname: { equals: username, mode: 'insensitive' } },
    });

    if (historical) {
      // Return 410 Gone - actor moved/deleted
      return new NextResponse(null, { status: 410 });
    }

    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  const actorUrl = getActorUrl(username);

  // Return WebFinger response
  const webfingerResponse = {
    subject: `acct:${username}@${domain}`,
    aliases: [actorUrl],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actorUrl,
      },
      {
        rel: 'http://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: `https://${domain}/profile/${username}`,
      },
    ],
  };

  return NextResponse.json(webfingerResponse, {
    headers: {
      'Content-Type': 'application/jrd+json; charset=utf-8',
      'Cache-Control': 'max-age=3600',
    },
  });
}
