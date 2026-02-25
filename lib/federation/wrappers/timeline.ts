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
} from '@/lib/schema';
import type { SocialStatus, SocialActor } from '@/lib/schema';
import { and, eq, ne, sql, desc, isNotNull, not, or } from 'drizzle-orm';
import { socialConfig } from '../index';

const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

/**
 * Drizzle SQL condition to exclude expired statuses (soft delete).
 */
function notExpired() {
  return sql`(${socialStatuses.expiresAt} IS NULL OR ${socialStatuses.expiresAt} > NOW())`;
}

/**
 * Check if a JSONB array column contains a specific string value.
 * PostgreSQL: column @> to_jsonb(value::text)
 */
 
function jsonbArrayContains(column: any, value: string) {
  return sql`${column} @> to_jsonb(${value}::text)`;
}

export type StatusWithActorAndLike = SocialStatus & {
  actor: SocialActor;
  liked: boolean;
};

export type TimelineResult = {
  statuses: StatusWithActorAndLike[];
  nextCursor: string | null;
};

/**
 * Get home timeline for an actor.
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
      actor: true,
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
    const { likes, ...rest } = row;
    return { ...rest, liked: likes.length > 0 };
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
        notExpired(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: true,
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
    const { likes, ...rest } = rowWithLikes;
    return { ...rest, liked: likes ? likes.length > 0 : false };
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
      actor: true,
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
    const { likes, ...rest } = rowWithLikes;
    return { ...rest, liked: likes ? likes.length > 0 : false };
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
      actor: true,
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
    const { likes, ...rest } = row;
    return { ...rest, liked: likes.length > 0 };
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
      actor: true,
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
    const { likes, ...rest } = row;
    return { ...rest, liked: likes.length > 0 };
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
      actor: true,
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
    const { likes, ...rest } = row;
    return { ...rest, liked: likes.length > 0 };
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
    where: eq(socialStatuses.id, statusId),
    with: {
      actor: true,
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
  const { likes, ...rest } = rowWithLikes;
  return { ...rest, liked: likes ? likes.length > 0 : false };
}
