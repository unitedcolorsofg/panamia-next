/**
 * Follow Management
 *
 * High-level functions for managing follow relationships.
 * For Phase 4 (local only), follows are immediately accepted.
 * Federation (Phase 7+) will add pending/accepted states for remote follows.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import { getPrisma } from '@/lib/prisma';
import { SocialFollow, SocialActor } from '@prisma/client';
import { canFollow, GateResult } from '../gates';
import { socialConfig } from '../index';

export type FollowResult =
  | { success: true; follow: SocialFollow }
  | { success: false; error: string; gateResult?: GateResult };

export type ActorWithFollowInfo = SocialActor & {
  isFollowing?: boolean;
  isFollowedBy?: boolean;
};

/**
 * Generate a follow activity URI
 */
function generateFollowUri(actorUsername: string, followId: string): string {
  return `https://${socialConfig.domain}/users/${actorUsername}/follows/${followId}`;
}

/**
 * Create a follow relationship
 *
 * For local follows, status is immediately 'accepted'.
 * Future: remote follows will start as 'pending'.
 */
export async function createFollow(
  actorId: string,
  targetActorId: string
): Promise<FollowResult> {
  const prisma = await getPrisma();

  // Can't follow yourself
  if (actorId === targetActorId) {
    return { success: false, error: 'Cannot follow yourself' };
  }

  // Fetch both actors
  const [actor, targetActor] = await Promise.all([
    prisma.socialActor.findUnique({
      where: { id: actorId },
      include: { profile: true },
    }),
    prisma.socialActor.findUnique({
      where: { id: targetActorId },
    }),
  ]);

  if (!actor) {
    return { success: false, error: 'Actor not found' };
  }

  if (!targetActor) {
    return { success: false, error: 'Target actor not found' };
  }

  // Check gate (profile must exist for local actors)
  if (actor.profile) {
    const gateResult = canFollow(actor.profile);
    if (!gateResult.allowed) {
      return {
        success: false,
        error: 'Not eligible to follow',
        gateResult,
      };
    }
  }

  // Check if already following
  const existing = await prisma.socialFollow.findUnique({
    where: {
      actorId_targetActorId: {
        actorId,
        targetActorId,
      },
    },
  });

  if (existing) {
    return { success: true, follow: existing };
  }

  // Create the follow (local = immediately accepted)
  const isLocalTarget = targetActor.domain === socialConfig.domain;

  const follow = await prisma.socialFollow.create({
    data: {
      actorId,
      targetActorId,
      status: isLocalTarget ? 'accepted' : 'pending',
      acceptedAt: isLocalTarget ? new Date() : null,
      // URI will be set after we have the ID
      uri: '',
    },
  });

  // Update with proper URI
  const uri = generateFollowUri(actor.username, follow.id);
  const updatedFollow = await prisma.socialFollow.update({
    where: { id: follow.id },
    data: { uri },
  });

  // Update counts for accepted follows
  if (updatedFollow.status === 'accepted') {
    await Promise.all([
      prisma.socialActor.update({
        where: { id: actorId },
        data: { followingCount: { increment: 1 } },
      }),
      prisma.socialActor.update({
        where: { id: targetActorId },
        data: { followersCount: { increment: 1 } },
      }),
    ]);
  }

  return { success: true, follow: updatedFollow };
}

/**
 * Delete a follow relationship (unfollow)
 */
export async function deleteFollow(
  actorId: string,
  targetActorId: string
): Promise<{ success: boolean; error?: string }> {
  const prisma = await getPrisma();

  const follow = await prisma.socialFollow.findUnique({
    where: {
      actorId_targetActorId: {
        actorId,
        targetActorId,
      },
    },
  });

  if (!follow) {
    return { success: true }; // Already not following
  }

  // Delete the follow
  await prisma.socialFollow.delete({
    where: { id: follow.id },
  });

  // Update counts if it was accepted
  if (follow.status === 'accepted') {
    await Promise.all([
      prisma.socialActor.update({
        where: { id: actorId },
        data: { followingCount: { decrement: 1 } },
      }),
      prisma.socialActor.update({
        where: { id: targetActorId },
        data: { followersCount: { decrement: 1 } },
      }),
    ]);
  }

  return { success: true };
}

/**
 * Check if actor is following target
 */
export async function isFollowing(
  actorId: string,
  targetActorId: string
): Promise<boolean> {
  const prisma = await getPrisma();

  const follow = await prisma.socialFollow.findUnique({
    where: {
      actorId_targetActorId: {
        actorId,
        targetActorId,
      },
    },
  });

  return follow?.status === 'accepted';
}

/**
 * Get followers of an actor
 */
export async function getFollowers(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<{ actors: SocialActor[]; nextCursor: string | null }> {
  const prisma = await getPrisma();

  const follows = await prisma.socialFollow.findMany({
    where: {
      targetActorId: actorId,
      status: 'accepted',
    },
    include: { actor: true },
    orderBy: { acceptedAt: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  });

  const hasMore = follows.length > limit;
  const items = hasMore ? follows.slice(0, limit) : follows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    actors: items.map((f) => f.actor),
    nextCursor,
  };
}

/**
 * Get actors that an actor is following
 */
export async function getFollowing(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<{ actors: SocialActor[]; nextCursor: string | null }> {
  const prisma = await getPrisma();

  const follows = await prisma.socialFollow.findMany({
    where: {
      actorId,
      status: 'accepted',
    },
    include: { targetActor: true },
    orderBy: { acceptedAt: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  });

  const hasMore = follows.length > limit;
  const items = hasMore ? follows.slice(0, limit) : follows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    actors: items.map((f) => f.targetActor),
    nextCursor,
  };
}

/**
 * Get follow relationships for an actor relative to a viewer
 * Returns whether the viewer follows/is followed by the actor
 */
export async function getFollowRelationship(
  viewerActorId: string | null,
  targetActorId: string
): Promise<{ isFollowing: boolean; isFollowedBy: boolean }> {
  if (!viewerActorId) {
    return { isFollowing: false, isFollowedBy: false };
  }

  const prisma = await getPrisma();

  const [following, followedBy] = await Promise.all([
    prisma.socialFollow.findUnique({
      where: {
        actorId_targetActorId: {
          actorId: viewerActorId,
          targetActorId,
        },
      },
    }),
    prisma.socialFollow.findUnique({
      where: {
        actorId_targetActorId: {
          actorId: targetActorId,
          targetActorId: viewerActorId,
        },
      },
    }),
  ]);

  return {
    isFollowing: following?.status === 'accepted',
    isFollowedBy: followedBy?.status === 'accepted',
  };
}
