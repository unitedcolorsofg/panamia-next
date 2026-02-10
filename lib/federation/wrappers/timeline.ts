/**
 * Timeline Management
 *
 * High-level functions for querying timelines.
 * Supports home timeline (posts from followed + self) and user posts.
 *
 * IMPORTANT: Direct messages and voice memos are EXCLUDED from Home and Public
 * timelines. They should only appear in /updates (@-me and Sent tabs).
 * DMs are identified by NOT having the PUBLIC URI in recipientTo or recipientCc.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import { getPrisma } from '@/lib/prisma';
import { SocialStatus, SocialActor, SocialLike, Prisma } from '@prisma/client';
import { socialConfig } from '../index';

/**
 * Filter condition to exclude expired statuses (soft delete).
 * Includes statuses where:
 * - expiresAt is null (no expiration)
 * - expiresAt is in the future
 */
const notExpiredFilter: Prisma.SocialStatusWhereInput = {
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
};

export type StatusWithActorAndLike = SocialStatus & {
  actor: SocialActor;
  liked: boolean;
};

export type TimelineResult = {
  statuses: StatusWithActorAndLike[];
  nextCursor: string | null;
};

/**
 * Get home timeline for an actor
 *
 * Returns posts from:
 * - Actors the user follows (accepted follows only)
 * - The user's own posts
 *
 * Excludes:
 * - Drafts (unpublished)
 * - Replies (only top-level posts in timeline)
 * - Direct messages (shown in /updates instead)
 */
export async function getHomeTimeline(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const prisma = await getPrisma();
  const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

  // Get list of actors this user follows
  const follows = await prisma.socialFollow.findMany({
    where: {
      actorId,
      status: 'accepted',
    },
    select: { targetActorId: true },
  });

  const followedActorIds = follows.map((f) => f.targetActorId);

  // Include self in timeline
  const timelineActorIds = [...followedActorIds, actorId];

  // Query statuses, EXCLUDING direct messages and voice memos.
  // DMs/voice memos don't have PUBLIC in recipientTo or recipientCc.
  // They should only appear in /updates (@-me and Sent tabs), never in timelines.
  const statuses = await prisma.socialStatus.findMany({
    where: {
      actorId: { in: timelineActorIds },
      published: { not: null },
      inReplyToId: null, // Only top-level posts
      // Use AND to combine both OR conditions properly (Prisma overwrites duplicate OR keys)
      AND: [
        // Must have PUBLIC visibility (excludes DMs/voice memos)
        {
          OR: [
            { recipientTo: { array_contains: PUBLIC } },
            { recipientCc: { array_contains: PUBLIC } },
          ],
        },
        // Must not be expired
        notExpiredFilter,
      ],
    },
    include: {
      actor: true,
      attachments: true,
      likes: {
        where: { actorId },
        select: { id: true },
      },
    },
    orderBy: { published: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  });

  const hasMore = statuses.length > limit;
  const items = hasMore ? statuses.slice(0, limit) : statuses;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Transform to include liked boolean and remove likes array
  const statusesWithLiked: StatusWithActorAndLike[] = items.map((status) => {
    const { likes, ...statusWithoutLikes } = status;
    return {
      ...statusWithoutLikes,
      liked: likes.length > 0,
    };
  });

  return { statuses: statusesWithLiked, nextCursor };
}

/**
 * Get posts by a specific actor
 *
 * @param actorId - The actor whose posts to fetch
 * @param viewerActorId - Optional viewer for like status
 * @param includeReplies - Whether to include replies (default: false)
 */
export async function getActorPosts(
  actorId: string,
  viewerActorId?: string,
  cursor?: string,
  limit: number = 20,
  includeReplies: boolean = false
): Promise<TimelineResult> {
  const prisma = await getPrisma();

  const statuses = await prisma.socialStatus.findMany({
    where: {
      actorId,
      published: { not: null },
      ...(includeReplies ? {} : { inReplyToId: null }),
      ...notExpiredFilter,
    },
    include: {
      actor: true,
      attachments: true,
      ...(viewerActorId && {
        likes: {
          where: { actorId: viewerActorId },
          select: { id: true },
        },
      }),
    },
    orderBy: { published: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  });

  const hasMore = statuses.length > limit;
  const items = hasMore ? statuses.slice(0, limit) : statuses;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Transform to include liked boolean and remove likes array
  const statusesWithLiked: StatusWithActorAndLike[] = items.map((status) => {
    const statusWithLikes = status as typeof status & {
      likes?: { id: string }[];
    };
    const likesArray = statusWithLikes.likes;
    const { likes: _likes, ...statusWithoutLikes } = statusWithLikes;
    return {
      ...statusWithoutLikes,
      liked: likesArray ? likesArray.length > 0 : false,
    };
  });

  return { statuses: statusesWithLiked, nextCursor };
}

/**
 * Get public timeline (local posts with public visibility)
 *
 * Shows published posts from local users that have public visibility.
 * Unlisted posts are excluded (they're accessible by URL but not shown here).
 * Does not include remote posts.
 */
export async function getPublicTimeline(
  viewerActorId?: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const prisma = await getPrisma();
  const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

  // Query public posts, EXCLUDING DMs/voice memos (shown only in /updates)
  const statuses = await prisma.socialStatus.findMany({
    where: {
      published: { not: null },
      inReplyToId: null, // Only top-level posts
      actor: {
        domain: socialConfig.domain, // Local actors only
      },
      // Only show posts with public visibility (recipientTo contains Public)
      // DMs/voice memos don't have PUBLIC, so they're automatically excluded
      recipientTo: { array_contains: PUBLIC },
      // Must not be expired (use AND to avoid OR key conflicts)
      AND: [notExpiredFilter],
    },
    include: {
      actor: true,
      attachments: true,
      ...(viewerActorId && {
        likes: {
          where: { actorId: viewerActorId },
          select: { id: true },
        },
      }),
    },
    orderBy: { published: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  });

  const hasMore = statuses.length > limit;
  const items = hasMore ? statuses.slice(0, limit) : statuses;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Transform to include liked boolean and remove likes array
  const statusesWithLiked: StatusWithActorAndLike[] = items.map((status) => {
    const statusWithLikes = status as typeof status & {
      likes?: { id: string }[];
    };
    const likesArray = statusWithLikes.likes;
    const { likes: _likes, ...statusWithoutLikes } = statusWithLikes;
    return {
      ...statusWithoutLikes,
      liked: likesArray ? likesArray.length > 0 : false,
    };
  });

  return { statuses: statusesWithLiked, nextCursor };
}

/**
 * Get received direct messages (inbox) for an actor
 *
 * Returns direct messages where the actor is a recipient.
 * Excludes messages sent by the actor themselves.
 *
 * NOTE: DMs and voice memos are shown ONLY in /updates (not in Home/Public timelines).
 * This function is used by the @-me tab in /updates.
 */
export async function getReceivedDirectMessages(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const prisma = await getPrisma();

  // Get the actor's URI for recipient matching
  const actor = await prisma.socialActor.findUnique({
    where: { id: actorId },
    select: { uri: true },
  });

  if (!actor) {
    return { statuses: [], nextCursor: null };
  }

  // Direct messages have the recipient's URI in recipientTo
  // and don't have PUBLIC in either recipientTo or recipientCc
  const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

  const statuses = await prisma.socialStatus.findMany({
    where: {
      published: { not: null },
      // Must be addressed to this actor
      recipientTo: { array_contains: actor.uri },
      // Must NOT be from this actor (exclude sent messages)
      actorId: { not: actorId },
      // Exclude public posts (direct messages don't have PUBLIC)
      NOT: {
        OR: [
          { recipientTo: { array_contains: PUBLIC } },
          { recipientCc: { array_contains: PUBLIC } },
        ],
      },
      ...notExpiredFilter,
    },
    include: {
      actor: true,
      attachments: true,
      likes: {
        where: { actorId },
        select: { id: true },
      },
    },
    orderBy: { published: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  });

  const hasMore = statuses.length > limit;
  const items = hasMore ? statuses.slice(0, limit) : statuses;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const statusesWithLiked: StatusWithActorAndLike[] = items.map((status) => {
    const { likes, ...statusWithoutLikes } = status;
    return {
      ...statusWithoutLikes,
      liked: likes.length > 0,
    };
  });

  return { statuses: statusesWithLiked, nextCursor };
}

/**
 * Get sent direct messages for an actor
 *
 * Returns direct messages sent by this actor to specific recipients.
 *
 * NOTE: DMs and voice memos are shown ONLY in /updates (not in Home/Public timelines).
 * This function is used by the Sent tab in /updates.
 */
export async function getSentDirectMessages(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const prisma = await getPrisma();
  const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

  // Direct messages are sent by this actor and don't have PUBLIC visibility
  const statuses = await prisma.socialStatus.findMany({
    where: {
      actorId,
      published: { not: null },
      // Exclude public posts (direct messages don't have PUBLIC)
      NOT: {
        OR: [
          { recipientTo: { array_contains: PUBLIC } },
          { recipientCc: { array_contains: PUBLIC } },
        ],
      },
      ...notExpiredFilter,
    },
    include: {
      actor: true,
      attachments: true,
      likes: {
        where: { actorId },
        select: { id: true },
      },
    },
    orderBy: { published: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  });

  const hasMore = statuses.length > limit;
  const items = hasMore ? statuses.slice(0, limit) : statuses;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const statusesWithLiked: StatusWithActorAndLike[] = items.map((status) => {
    const { likes, ...statusWithoutLikes } = status;
    return {
      ...statusWithoutLikes,
      liked: likes.length > 0,
    };
  });

  return { statuses: statusesWithLiked, nextCursor };
}

/**
 * Get all posts that "@" a user (mentions + DMs)
 *
 * Returns:
 * - Direct messages where the actor is a recipient
 * - Public/unlisted posts that mention the actor via @username
 *
 * Excludes posts by the actor themselves.
 *
 * NOTE: This is the primary function for the @-me tab in /updates.
 * DMs/voice memos appear here (and in Sent), NOT in Home/Public timelines.
 */
export async function getAtMeTimeline(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const prisma = await getPrisma();

  // Get the actor's URI for recipient matching
  const actor = await prisma.socialActor.findUnique({
    where: { id: actorId },
    select: { uri: true },
  });

  if (!actor) {
    return { statuses: [], nextCursor: null };
  }

  // Query statuses that either:
  // 1. Are DMs addressed to this actor (recipientTo contains actor.uri, no PUBLIC)
  // 2. Have a Mention tag pointing to this actor's URI
  const statuses = await prisma.socialStatus.findMany({
    where: {
      published: { not: null },
      // Must NOT be from this actor
      actorId: { not: actorId },
      OR: [
        // DMs addressed to this actor
        { recipientTo: { array_contains: actor.uri } },
        // Posts with a mention tag pointing to this actor
        {
          tags: {
            some: {
              type: 'Mention',
              href: actor.uri,
            },
          },
        },
      ],
      ...notExpiredFilter,
    },
    include: {
      actor: true,
      attachments: true,
      likes: {
        where: { actorId },
        select: { id: true },
      },
    },
    orderBy: { published: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  });

  const hasMore = statuses.length > limit;
  const items = hasMore ? statuses.slice(0, limit) : statuses;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const statusesWithLiked: StatusWithActorAndLike[] = items.map((status) => {
    const { likes, ...statusWithoutLikes } = status;
    return {
      ...statusWithoutLikes,
      liked: likes.length > 0,
    };
  });

  return { statuses: statusesWithLiked, nextCursor };
}

/**
 * Get a single status with like status for viewer
 */
export async function getStatusWithLikeStatus(
  statusId: string,
  viewerActorId?: string
): Promise<StatusWithActorAndLike | null> {
  const prisma = await getPrisma();

  const status = await prisma.socialStatus.findUnique({
    where: { id: statusId },
    include: {
      actor: true,
      attachments: true,
      ...(viewerActorId && {
        likes: {
          where: { actorId: viewerActorId },
          select: { id: true },
        },
      }),
    },
  });

  if (!status) return null;

  const statusWithLikes = status as typeof status & {
    likes?: { id: string }[];
  };
  const likesArray = statusWithLikes.likes;

  // Destructure to remove likes array from the result
  const { likes: _likes, ...statusWithoutLikes } =
    statusWithLikes as typeof status & { likes?: { id: string }[] };

  return {
    ...statusWithoutLikes,
    liked: likesArray ? likesArray.length > 0 : false,
  };
}
