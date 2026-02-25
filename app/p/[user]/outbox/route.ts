/**
 * ActivityPub Outbox Collection
 *
 * Returns an OrderedCollection (summary) or OrderedCollectionPage (paginated)
 * of public Create activities for an actor.
 *
 * Only truly public statuses (recipientTo contains PUBLIC) are included.
 * Unlisted posts (local-only) are excluded from federation.
 *
 * Ported from external/activities.next/app/api/users/[username]/outbox/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActorByScreenname } from '@/lib/federation/wrappers/actor';
import { db } from '@/lib/db';
import { socialStatuses } from '@/lib/schema';
import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { socialConfig } from '@/lib/federation';

const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user: string }> }
) {
  const { user } = await params;

  const actor = await getActorByScreenname(user);
  if (!actor) {
    return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
  }

  const outboxUrl = actor.outboxUrl;
  const pageParam = request.nextUrl.searchParams.get('page');

  // Without ?page → return OrderedCollection summary
  if (!pageParam) {
    return NextResponse.json(
      {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: outboxUrl,
        type: 'OrderedCollection',
        totalItems: actor.statusCount,
        first: `${outboxUrl}?page=true`,
        last: `${outboxUrl}?min_id=0&page=true`,
      },
      {
        headers: {
          'Content-Type': 'application/activity+json; charset=utf-8',
        },
      }
    );
  }

  // With ?page=true → return OrderedCollectionPage with Create activities
  const statuses = await db.query.socialStatuses.findMany({
    where: and(
      eq(socialStatuses.actorId, actor.id),
      sql`${socialStatuses.published} IS NOT NULL`,
      isNull(socialStatuses.inReplyToId),
      sql`${socialStatuses.recipientTo} @> ${JSON.stringify([PUBLIC])}::jsonb`,
      or(
        isNull(socialStatuses.expiresAt),
        gt(socialStatuses.expiresAt, new Date())
      )
    ),
    with: { attachments: true },
    orderBy: (t, { desc }) => [desc(t.published)],
    limit: 20,
  });

  const orderedItems = statuses.map((status) => ({
    id: `${status.uri}/activity`,
    type: 'Create',
    actor: actor.uri,
    published: status.published!.toISOString(),
    to: status.recipientTo as string[],
    cc: status.recipientCc as string[],
    object: {
      id: status.uri,
      type: 'Note',
      attributedTo: actor.uri,
      content: status.content || '',
      published: status.published!.toISOString(),
      to: status.recipientTo as string[],
      cc: status.recipientCc as string[],
      url:
        status.url ||
        `https://${socialConfig.domain}/p/${actor.username}/statuses/${status.id}`,
      inReplyTo: null,
      attachment: status.attachments.map((a) => ({
        type: 'Document',
        mediaType: a.mediaType || 'application/octet-stream',
        url: a.url,
        name: a.name || '',
      })),
      tag: [],
      summary: status.contentWarning || null,
    },
  }));

  return NextResponse.json(
    {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${outboxUrl}?page=true`,
      type: 'OrderedCollectionPage',
      partOf: outboxUrl,
      orderedItems,
    },
    {
      headers: {
        'Content-Type': 'application/activity+json; charset=utf-8',
      },
    }
  );
}
