/**
 * Follow Management
 *
 * High-level functions for managing follow relationships.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import { db } from '@/lib/db';
import { socialFollows, socialActors } from '@/lib/schema';
import type { SocialFollow, SocialActor } from '@/lib/schema';
import { and, eq, sql, desc } from 'drizzle-orm';
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
  return `https://${socialConfig.domain}/p/${actorUsername}/follows/${followId}`;
}

/**
 * Create a follow relationship
 */
export async function createFollow(
  actorId: string,
  targetActorId: string
): Promise<FollowResult> {
  // Can't follow yourself
  if (actorId === targetActorId) {
    return { success: false, error: 'Cannot follow yourself' };
  }

  // Fetch both actors
  const [actor, targetActor] = await Promise.all([
    db.query.socialActors.findFirst({
      where: eq(socialActors.id, actorId),
      with: { profile: true },
    }),
    db.query.socialActors.findFirst({
      where: eq(socialActors.id, targetActorId),
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
  const existing = await db.query.socialFollows.findFirst({
    where: and(
      eq(socialFollows.actorId, actorId),
      eq(socialFollows.targetActorId, targetActorId)
    ),
  });

  if (existing) {
    return { success: true, follow: existing };
  }

  // Create the follow (local = immediately accepted)
  const isLocalTarget = targetActor.domain === socialConfig.domain;

  const [follow] = await db
    .insert(socialFollows)
    .values({
      actorId,
      targetActorId,
      status: isLocalTarget ? 'accepted' : 'pending',
      acceptedAt: isLocalTarget ? new Date() : null,
      uri: '',
    })
    .returning();

  // Update with proper URI
  const uri = generateFollowUri(actor.username, follow.id);
  const [updatedFollow] = await db
    .update(socialFollows)
    .set({ uri })
    .where(eq(socialFollows.id, follow.id))
    .returning();

  // Update counts for accepted follows
  if (updatedFollow.status === 'accepted') {
    await Promise.all([
      db
        .update(socialActors)
        .set({ followingCount: sql`${socialActors.followingCount} + 1` })
        .where(eq(socialActors.id, actorId)),
      db
        .update(socialActors)
        .set({ followersCount: sql`${socialActors.followersCount} + 1` })
        .where(eq(socialActors.id, targetActorId)),
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
  const follow = await db.query.socialFollows.findFirst({
    where: and(
      eq(socialFollows.actorId, actorId),
      eq(socialFollows.targetActorId, targetActorId)
    ),
  });

  if (!follow) {
    return { success: true }; // Already not following
  }

  await db.delete(socialFollows).where(eq(socialFollows.id, follow.id));

  // Update counts if it was accepted
  if (follow.status === 'accepted') {
    await Promise.all([
      db
        .update(socialActors)
        .set({ followingCount: sql`${socialActors.followingCount} - 1` })
        .where(eq(socialActors.id, actorId)),
      db
        .update(socialActors)
        .set({ followersCount: sql`${socialActors.followersCount} - 1` })
        .where(eq(socialActors.id, targetActorId)),
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
  const follow = await db.query.socialFollows.findFirst({
    where: and(
      eq(socialFollows.actorId, actorId),
      eq(socialFollows.targetActorId, targetActorId)
    ),
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
  const follows = await db.query.socialFollows.findMany({
    where: (f, { and, eq, lt }) =>
      and(
        eq(f.targetActorId, actorId),
        eq(f.status, 'accepted'),
        cursor ? lt(f.id, cursor) : undefined
      ),
    with: { actor: true },
    orderBy: [desc(socialFollows.acceptedAt), desc(socialFollows.id)],
    limit: limit + 1,
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
  const follows = await db.query.socialFollows.findMany({
    where: (f, { and, eq, lt }) =>
      and(
        eq(f.actorId, actorId),
        eq(f.status, 'accepted'),
        cursor ? lt(f.id, cursor) : undefined
      ),
    with: { targetActor: true },
    orderBy: [desc(socialFollows.acceptedAt), desc(socialFollows.id)],
    limit: limit + 1,
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
 */
export async function getFollowRelationship(
  viewerActorId: string | null,
  targetActorId: string
): Promise<{ isFollowing: boolean; isFollowedBy: boolean }> {
  if (!viewerActorId) {
    return { isFollowing: false, isFollowedBy: false };
  }

  const [following, followedBy] = await Promise.all([
    db.query.socialFollows.findFirst({
      where: and(
        eq(socialFollows.actorId, viewerActorId),
        eq(socialFollows.targetActorId, targetActorId)
      ),
    }),
    db.query.socialFollows.findFirst({
      where: and(
        eq(socialFollows.actorId, targetActorId),
        eq(socialFollows.targetActorId, viewerActorId)
      ),
    }),
  ]);

  return {
    isFollowing: following?.status === 'accepted',
    isFollowedBy: followedBy?.status === 'accepted',
  };
}
