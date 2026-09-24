/**
 * Status Visibility
 *
 * One predicate that decides whether a viewer may read a status, plus the
 * small SQL helpers the status read paths share.
 *
 * WHY THIS FILE EXISTS: visibility used to be spelled out at each call site.
 * Three read paths -- an actor's post list, a status permalink, and a reply
 * list -- were written without it, and because a status row carries direct
 * messages and followers-only posts in the same table as public ones, those
 * endpoints returned both to anyone who asked. Addressing is checked here,
 * once, so a new read path cannot forget it. If you are adding a query that
 * returns statuses, it goes through `visibleTo`.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import { socialStatuses } from '@/lib/schema';
import { eq, or, sql, type SQL } from 'drizzle-orm';

export const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

/**
 * Check if a JSONB array column contains a specific string value.
 * PostgreSQL: column @> to_jsonb(value::text)
 */
export function jsonbArrayContains(
  column: SQL<unknown> | { getSQL(): SQL<unknown> },
  value: string
) {
  return sql`${column} @> to_jsonb(${value}::text)`;
}

/**
 * Drizzle SQL condition to exclude expired statuses (soft delete).
 */
export function notExpired() {
  return sql`(${socialStatuses.expiresAt} IS NULL OR ${socialStatuses.expiresAt} > NOW())`;
}

/**
 * Addressed to the public collection, in `to` or `cc`.
 *
 * Covers both public (to: Public) and unlisted (cc: Public) posts, which are
 * the two the world may read. A public *timeline* wants the stricter `to`
 * test instead, so that one stays spelled out at its call site.
 */
export function isPublicStatus(): SQL {
  return or(
    jsonbArrayContains(socialStatuses.recipientTo, PUBLIC),
    jsonbArrayContains(socialStatuses.recipientCc, PUBLIC)
  )!;
}

/**
 * Can this viewer read this status?
 *
 * ActivityPub addressing is the source of truth, written by `createStatus`:
 *
 *   public    to: [Public]           cc: [followers]
 *   unlisted  to: [followers]        cc: [Public]
 *   private   to: [followers]        cc: []
 *   direct    to: [recipient, ...]   cc: []
 *
 * A viewer may read a status when any of these hold:
 *   1. it is addressed to the public collection;
 *   2. they wrote it;
 *   3. they are named in `to`/`cc` -- a direct message they received;
 *   4. it is addressed to the author's followers collection and they are an
 *      accepted follower.
 *
 * Case 4 deliberately tests the author's *followers collection* rather than
 * just "does the viewer follow the author". A direct message is addressed to
 * named recipients and never to that collection, so following someone does
 * not hand you their DMs.
 *
 * Passing no viewer yields the anonymous case: public posts only.
 */
export function visibleTo(viewerActorId?: string): SQL {
  const isPublic = isPublicStatus();

  if (!viewerActorId) return isPublic;

  // Named in the recipients: a direct message addressed to this viewer.
  const addressedToViewer = sql`EXISTS (
    SELECT 1 FROM social_actors viewer
    WHERE viewer.id = ${viewerActorId}
      AND (${socialStatuses.recipientTo} @> to_jsonb(viewer.uri)
        OR ${socialStatuses.recipientCc} @> to_jsonb(viewer.uri))
  )`;

  // Followers-only, and this viewer is an accepted follower of the author.
  const followersOnly = sql`EXISTS (
    SELECT 1 FROM social_actors author
    JOIN social_follows f
      ON f.target_actor_id = author.id
     AND f.actor_id = ${viewerActorId}
     AND f.status = 'accepted'
    WHERE author.id = ${socialStatuses.actorId}
      AND (${socialStatuses.recipientTo} @> to_jsonb(author.followers_url)
        OR ${socialStatuses.recipientCc} @> to_jsonb(author.followers_url))
  )`;

  return or(
    isPublic,
    eq(socialStatuses.actorId, viewerActorId),
    addressedToViewer,
    followersOnly
  )!;
}
