/**
 * Timeline Management
 *
 * High-level functions for querying timelines.
 * Supports home timeline (posts from followed + self) and user posts.
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
 */
export async function getHomeTimeline(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const prisma = await getPrisma();

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

  // Query statuses
  const statuses = await prisma.socialStatus.findMany({
    where: {
      actorId: { in: timelineActorIds },
      published: { not: null },
      inReplyToId: null, // Only top-level posts
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

  const statuses = await prisma.socialStatus.findMany({
    where: {
      published: { not: null },
      inReplyToId: null, // Only top-level posts
      actor: {
        domain: socialConfig.domain, // Local actors only
      },
      // Only show posts with public visibility (recipientTo contains Public)
      recipientTo: { array_contains: PUBLIC },
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
