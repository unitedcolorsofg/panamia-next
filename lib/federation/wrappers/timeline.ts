/**
 * Timeline Management
 *
 * High-level functions for querying timelines.
 *
 * IMPORTANT: Direct messages are EXCLUDED from Home and Public timelines.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import { db } from '@/lib/db';
import {
  socialStatuses,
  socialFollows,
  socialActors,
  socialLikes,
  PUBLIC_ACTOR_COLUMNS,
} from '@/lib/schema';
import type { SocialStatus, PublicSocialActor } from '@/lib/schema';
import { and, eq, sql, or } from 'drizzle-orm';
import { countyShortLabel } from '@/lib/county';
import { socialConfig } from '../index';
import {
  PUBLIC,
  jsonbArrayContains,
  notExpired,
  visibleTo,
} from './visibility';

export type PublicActorWithCounty = PublicSocialActor & {
  /**
   * Where this person is, for the badge beside their name. Null for a remote
   * actor (no local profile to read) and for a member who has not set an
   * address, and both mean the same thing to a caller: render nothing.
   */
  county: string | null;
};

export type StatusWithActorAndLike = SocialStatus & {
  actor: PublicActorWithCounty;
  liked: boolean;
};

/**
 * The actor shape every timeline returns.
 *
 * Written once and shared because seven read paths in this file select an
 * actor, and a per-call-site spelling is how a field ends up present on the
 * home feed and missing on a permalink for the same post. The directory's
 * account-type gate had to be repaired in four places for that exact reason;
 * this keeps the next field from repeating it.
 */
const ACTOR_WITH = {
  columns: PUBLIC_ACTOR_COLUMNS,
  with: { profile: { columns: { counties: true } } },
} as const;

/**
 * Flatten the joined profile into the county the client actually renders.
 *
 * The nested profile row is dropped rather than forwarded: it was selected to
 * answer one question, and passing the whole thing outward would make every
 * column added to profiles later a silent addition to a public response.
 */
function publicActor(actor: {
  profile?: { counties: unknown } | null;
}): PublicActorWithCounty {
  const { profile, ...rest } = actor;
  return {
    ...(rest as unknown as PublicSocialActor),
    county: countyShortLabel(profile?.counties),
  };
}

export type TimelineResult = {
  statuses: StatusWithActorAndLike[];
  nextCursor: string | null;
};

/**
 * Get home timeline for an actor.
 *
 * DESIGN NOTE: This is a deliberate fan-out-on-READ implementation. We do
 * NOT maintain per-user `timeline_entries` rows that get written on every
 * post creation. That would mean 100+ INSERTs per post in a serverless
 * request handler, synchronous deletes on every unpost, and a write
 * amplification problem that PG + Hyperdrive is not the right tool for.
 *
 * If you're reading this and thinking "we should move to fan-out on write
 * now that we have Durable Objects" — don't. A per-user timeline DO would
 * still cold-start from storage and hit the DB on hibernation wake, so it
 * buys nothing over the query below while adding a stateful component.
 * Durable Objects are the right tool for outbound delivery fan-out and for
 * realtime push (see the DEFERRED comments in ./status.ts), NOT for
 * materializing the read path.
 */
export async function getHomeTimeline(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  // Get list of actors this user follows
  const follows = await db
    .select({ targetActorId: socialFollows.targetActorId })
    .from(socialFollows)
    .where(
      and(
        eq(socialFollows.actorId, actorId),
        eq(socialFollows.status, 'accepted')
      )
    );

  const followedActorIds = follows.map((f) => f.targetActorId);
  const timelineActorIds = [...followedActorIds, actorId];

  const rows = await db.query.socialStatuses.findMany({
    where: (s, { and, isNotNull, isNull }) =>
      and(
        sql`${s.actorId} = ANY(ARRAY[${sql.join(
          timelineActorIds.map((id) => sql`${id}`),
          sql`, `
        )}]::text[])`,
        isNotNull(s.published),
        isNull(s.inReplyToId),
        or(
          jsonbArrayContains(socialStatuses.recipientTo, PUBLIC),
          jsonbArrayContains(socialStatuses.recipientCc, PUBLIC)
        ),
        notExpired(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      likes: {
        where: eq(socialLikes.actorId, actorId),
        columns: { id: true },
      },
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const statuses: StatusWithActorAndLike[] = items.map((row) => {
    const { likes, actor, ...rest } = row;
    return { ...rest, actor: publicActor(actor), liked: likes.length > 0 };
  });

  return { statuses, nextCursor };
}

/**
 * Get posts by a specific actor.
 */
export async function getActorPosts(
  actorId: string,
  viewerActorId?: string,
  cursor?: string,
  limit: number = 20,
  includeReplies: boolean = false
): Promise<TimelineResult> {
  const rows = await db.query.socialStatuses.findMany({
    where: (s, { and, eq, isNotNull, isNull }) =>
      and(
        eq(s.actorId, actorId),
        isNotNull(s.published),
        includeReplies ? undefined : isNull(s.inReplyToId),
        visibleTo(viewerActorId),
        notExpired(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      ...(viewerActorId && {
        likes: {
          where: eq(socialLikes.actorId, viewerActorId),
          columns: { id: true },
        },
      }),
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const statuses: StatusWithActorAndLike[] = items.map((row) => {
    const rowWithLikes = row as typeof row & { likes?: { id: string }[] };
    const { likes, actor, ...rest } = rowWithLikes;
    return {
      ...rest,
      actor: publicActor(actor),
      liked: likes ? likes.length > 0 : false,
    };
  });

  return { statuses, nextCursor };
}

/**
 * Get public timeline (local posts with public visibility).
 */
export async function getPublicTimeline(
  viewerActorId?: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const rows = await db.query.socialStatuses.findMany({
    where: (s, { and, isNotNull, isNull }) =>
      and(
        isNotNull(s.published),
        isNull(s.inReplyToId),
        jsonbArrayContains(socialStatuses.recipientTo, PUBLIC),
        notExpired(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      ...(viewerActorId && {
        likes: {
          where: eq(socialLikes.actorId, viewerActorId),
          columns: { id: true },
        },
      }),
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
    // Filter to local actors only (domain = socialConfig.domain)
    extras: {
      domainFilter: sql<string>`1`.as('_'),
    },
  });

  // Post-filter to local actors only (Drizzle doesn't support nested where on relations in findMany)
  const localRows = rows.filter((r) => r.actor.domain === socialConfig.domain);

  const hasMore = localRows.length > limit;
  const items = hasMore ? localRows.slice(0, limit) : localRows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const statuses: StatusWithActorAndLike[] = items.map((row) => {
    const rowWithLikes = row as typeof row & { likes?: { id: string }[] };
    const { likes, actor, ...rest } = rowWithLikes;
    return {
      ...rest,
      actor: publicActor(actor),
      liked: likes ? likes.length > 0 : false,
    };
  });

  return { statuses, nextCursor };
}

/**
 * Get received direct messages (inbox) for an actor.
 */
export async function getReceivedDirectMessages(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const actor = await db.query.socialActors.findFirst({
    where: eq(socialActors.id, actorId),
    columns: { uri: true },
  });

  if (!actor) {
    return { statuses: [], nextCursor: null };
  }

  const rows = await db.query.socialStatuses.findMany({
    where: (s, { and, isNotNull, ne }) =>
      and(
        isNotNull(s.published),
        ne(s.actorId, actorId),
        jsonbArrayContains(socialStatuses.recipientTo, actor.uri),
        sql`NOT (${jsonbArrayContains(socialStatuses.recipientTo, PUBLIC)} OR ${jsonbArrayContains(socialStatuses.recipientCc, PUBLIC)})`,
        notExpired(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      likes: {
        where: eq(socialLikes.actorId, actorId),
        columns: { id: true },
      },
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const statuses: StatusWithActorAndLike[] = items.map((row) => {
    const { likes, actor, ...rest } = row;
    return { ...rest, actor: publicActor(actor), liked: likes.length > 0 };
  });

  return { statuses, nextCursor };
}

/**
 * Get sent direct messages for an actor.
 */
export async function getSentDirectMessages(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const rows = await db.query.socialStatuses.findMany({
    where: (s, { and, eq, isNotNull }) =>
      and(
        eq(s.actorId, actorId),
        isNotNull(s.published),
        sql`NOT (${jsonbArrayContains(socialStatuses.recipientTo, PUBLIC)} OR ${jsonbArrayContains(socialStatuses.recipientCc, PUBLIC)})`,
        notExpired(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      likes: {
        where: eq(socialLikes.actorId, actorId),
        columns: { id: true },
      },
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const statuses: StatusWithActorAndLike[] = items.map((row) => {
    const { likes, actor, ...rest } = row;
    return { ...rest, actor: publicActor(actor), liked: likes.length > 0 };
  });

  return { statuses, nextCursor };
}

/**
 * Get all posts that "@" a user (mentions + DMs).
 */
export async function getAtMeTimeline(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const actor = await db.query.socialActors.findFirst({
    where: eq(socialActors.id, actorId),
    columns: { uri: true },
  });

  if (!actor) {
    return { statuses: [], nextCursor: null };
  }

  const rows = await db.query.socialStatuses.findMany({
    where: (s, { and, isNotNull, ne }) =>
      and(
        isNotNull(s.published),
        ne(s.actorId, actorId),
        or(
          jsonbArrayContains(socialStatuses.recipientTo, actor.uri),
          sql`EXISTS (
            SELECT 1 FROM social_tags st
            WHERE st.status_id = ${socialStatuses.id}
            AND st.type = 'Mention'
            AND st.href = ${actor.uri}
          )`
        ),
        notExpired(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      likes: {
        where: eq(socialLikes.actorId, actorId),
        columns: { id: true },
      },
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const statuses: StatusWithActorAndLike[] = items.map((row) => {
    const { likes, actor, ...rest } = row;
    return { ...rest, actor: publicActor(actor), liked: likes.length > 0 };
  });

  return { statuses, nextCursor };
}

/**
 * Get a single status with like status for viewer.
 */
export async function getStatusWithLikeStatus(
  statusId: string,
  viewerActorId?: string
): Promise<StatusWithActorAndLike | null> {
  const row = await db.query.socialStatuses.findFirst({
    where: and(
      eq(socialStatuses.id, statusId),
      visibleTo(viewerActorId),
      notExpired()
    ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      ...(viewerActorId && {
        likes: {
          where: eq(socialLikes.actorId, viewerActorId),
          columns: { id: true },
        },
      }),
    },
  });

  if (!row) return null;

  const rowWithLikes = row as typeof row & { likes?: { id: string }[] };
  const { likes, actor, ...rest } = rowWithLikes;
  return {
    ...rest,
    actor: publicActor(actor),
    liked: likes ? likes.length > 0 : false,
  };
}
