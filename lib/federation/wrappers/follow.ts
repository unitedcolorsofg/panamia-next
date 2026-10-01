/**
 * Follow Management
 *
 * High-level functions for managing follow relationships.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import { db } from '@/lib/db';
import {
  socialFollows,
  socialActors,
  PUBLIC_ACTOR_COLUMNS,
} from '@/lib/schema';
import type { SocialFollow, PublicSocialActor } from '@/lib/schema';
import {
  and,
  eq,
  ne,
  sql,
  asc,
  desc,
  inArray,
  notInArray,
  getTableColumns,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { canFollow, GateResult } from '../gates';
import { socialConfig } from '../index';

export type FollowResult =
  | { success: true; follow: SocialFollow }
  | { success: false; error: string; gateResult?: GateResult };

export type ActorWithFollowInfo = PublicSocialActor & {
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
): Promise<{ actors: PublicSocialActor[]; nextCursor: string | null }> {
  const follows = await db.query.socialFollows.findMany({
    where: (f, { and, eq, lt }) =>
      and(
        eq(f.targetActorId, actorId),
        eq(f.status, 'accepted'),
        cursor ? lt(f.id, cursor) : undefined
      ),
    with: { actor: { columns: PUBLIC_ACTOR_COLUMNS } },
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
): Promise<{ actors: PublicSocialActor[]; nextCursor: string | null }> {
  const follows = await db.query.socialFollows.findMany({
    where: (f, { and, eq, lt }) =>
      and(
        eq(f.actorId, actorId),
        eq(f.status, 'accepted'),
        cursor ? lt(f.id, cursor) : undefined
      ),
    with: { targetActor: { columns: PUBLIC_ACTOR_COLUMNS } },
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

/**
 * Panas — mutual follows.
 *
 * A Pana is a connection both people opted into: A follows B and B follows A,
 * both accepted. Nobody lands in someone's Panas without having followed back
 * themselves, which is what makes the per-person badge safe to show: knowing
 * that you and someone are connected is context, not a graph map.
 *
 * The aggregate is a different matter and is owner-only — both the count and
 * the list. A visible total reads as a scoreboard and turns a mutual follow
 * from a relationship into a target. See docs/SOCIAL-GRAPH.md.
 *
 * The reciprocal row is found with a self-join rather than by intersecting two
 * result sets in JS, so the database does the set work and the count stays a
 * single round trip no matter how large either side is.
 */
const reciprocal = alias(socialFollows, 'reciprocal');

function mutualFollowJoin() {
  return and(
    eq(reciprocal.actorId, socialFollows.targetActorId),
    eq(reciprocal.targetActorId, socialFollows.actorId),
    eq(reciprocal.status, 'accepted')
  );
}

function outgoingAccepted(actorId: string) {
  return and(
    eq(socialFollows.actorId, actorId),
    eq(socialFollows.status, 'accepted')
  );
}

/**
 * How many Panas this actor has. Owner-only — callers must confirm the viewer
 * is the actor before returning this. See the note above on why.
 */
export async function countMutualFollows(actorId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(socialFollows)
    .innerJoin(reciprocal, mutualFollowJoin())
    .where(outgoingAccepted(actorId));

  return Number(row?.total ?? 0);
}

/**
 * The Panas themselves. Owner-only, like the count above — callers gate this on
 * the viewer being the actor, not merely on being signed in.
 *
 * This is a join rather than a relational query, so it cannot use
 * PUBLIC_ACTOR_COLUMNS -- the signing key is dropped from the projection
 * instead, so it is never read out of the database at all.
 */
export async function listMutualFollows(
  actorId: string,
  limit = 24
): Promise<PublicSocialActor[]> {
  const { privateKey: _privateKey, ...publicActorColumns } =
    getTableColumns(socialActors);

  const rows = await db
    .select({ actor: publicActorColumns })
    .from(socialFollows)
    .innerJoin(reciprocal, mutualFollowJoin())
    .innerJoin(socialActors, eq(socialActors.id, socialFollows.targetActorId))
    .where(outgoingAccepted(actorId))
    .orderBy(desc(socialFollows.acceptedAt), desc(socialFollows.id))
    .limit(limit);

  return rows.map((r) => r.actor);
}

export type SuggestedActor = PublicSocialActor & {
  /**
   * How many Panas the viewer and this actor share. Zero means the suggestion
   * came from the fallback tier rather than the graph.
   */
  mutualCount: number;
  /**
   * Whether this actor already follows the viewer. Suggestions exclude anyone
   * the viewer follows but not anyone who follows the viewer, so this row is
   * reachable and is the most actionable card in the module: one tap and the
   * pair are Panas. See docs/SOCIAL-GRAPH.md.
   */
  followsYou: boolean;
};

/** A suggestion before the inbound-follow pass annotates it. */
type SuggestionSeed = PublicSocialActor & { mutualCount: number };

/**
 * Mark which suggestions already follow the viewer.
 *
 * One query for the whole page rather than a join on each tier: the two tiers
 * are assembled separately and `limit` is single digits, so a set lookup over
 * the combined result is both simpler and fewer round trips than teaching each
 * branch the same left join.
 */
async function annotateFollowsYou(
  viewerActorId: string,
  seeds: SuggestionSeed[]
): Promise<SuggestedActor[]> {
  if (seeds.length === 0) return [];

  const inbound = await db
    .select({ actorId: socialFollows.actorId })
    .from(socialFollows)
    .where(
      and(
        eq(socialFollows.targetActorId, viewerActorId),
        eq(socialFollows.status, 'accepted'),
        inArray(
          socialFollows.actorId,
          seeds.map((seed) => seed.id)
        )
      )
    );

  const followers = new Set(inbound.map((row) => row.actorId));

  return seeds.map((seed) => ({
    ...seed,
    followsYou: followers.has(seed.id),
  }));
}

/** me -> M */
const panaOut = alias(socialFollows, 'pana_out');
/** M -> me, which makes M a Pana rather than just somebody I follow */
const panaIn = alias(socialFollows, 'pana_in');
/** M -> X */
const fofOut = alias(socialFollows, 'fof_out');
/** X -> M, so X is a Pana of M on the same bilateral terms */
const fofIn = alias(socialFollows, 'fof_in');

/**
 * Panas you might know.
 *
 * Suggests actors the viewer does not follow yet, in two tiers:
 *
 *   1. Panas in common. X is suggested when some M is a Pana of the viewer
 *      *and* a Pana of X. Every link walked is bilateral and accepted, so
 *      nobody is surfaced through a connection they did not opt into -- the
 *      same consent argument that lets countMutualFollows be public.
 *   2. Recently joined local actors, used only to top the list up. A brand new
 *      account has no graph to walk, and an empty "people to follow" module
 *      fails precisely the person it exists to help. These carry mutualCount 0
 *      so callers can tell a real overlap from a cold-start filler.
 *
 * Caller-scoped: it only ever answers about the viewer's own graph, so it has
 * the disclosure profile of /api/social/follows, not the public half of
 * /api/social/actors/[username]/panas. Callers must resolve the actor from the
 * session rather than from a route parameter.
 *
 * Exclusions are follows-only because the schema has no block or mute table
 * yet. When one lands it has to be subtracted here too, or this module becomes
 * the one place a blocked account reappears.
 */
export async function listSuggestedActors(
  actorId: string,
  limit = 6
): Promise<SuggestedActor[]> {
  const { privateKey: _privateKey, ...publicActorColumns } =
    getTableColumns(socialActors);

  // Any existing edge disqualifies a candidate, including a pending one --
  // re-suggesting somebody whose request is already awaiting approval reads as
  // the follow having silently failed.
  const alreadyAsked = db
    .select({ id: socialFollows.targetActorId })
    .from(socialFollows)
    .where(eq(socialFollows.actorId, actorId));

  const mutualCount = sql<number>`count(distinct ${panaOut.targetActorId})`;

  const shared = await db
    .select({ actor: publicActorColumns, mutualCount })
    .from(panaOut)
    .innerJoin(
      panaIn,
      and(
        eq(panaIn.actorId, panaOut.targetActorId),
        eq(panaIn.targetActorId, actorId),
        eq(panaIn.status, 'accepted')
      )
    )
    .innerJoin(
      fofOut,
      and(
        eq(fofOut.actorId, panaOut.targetActorId),
        eq(fofOut.status, 'accepted')
      )
    )
    .innerJoin(
      fofIn,
      and(
        eq(fofIn.actorId, fofOut.targetActorId),
        eq(fofIn.targetActorId, fofOut.actorId),
        eq(fofIn.status, 'accepted')
      )
    )
    .innerJoin(socialActors, eq(socialActors.id, fofOut.targetActorId))
    .where(
      and(
        eq(panaOut.actorId, actorId),
        eq(panaOut.status, 'accepted'),
        ne(fofOut.targetActorId, actorId),
        // Local only, matching the fallback tier. createFollow accepts a local
        // follow outright and leaves a remote one pending, so a mixed list
        // could not label its own buttons truthfully -- "Following" would be a
        // lie for half the cards. Suggesting fediverse accounts is a separate
        // feature with its own copy.
        eq(socialActors.domain, socialConfig.domain),
        notInArray(fofOut.targetActorId, alreadyAsked)
      )
    )
    // Grouping by the primary key lets Postgres carry the rest of the actor
    // columns through by functional dependency.
    .groupBy(socialActors.id)
    // asc(id) is a tiebreaker, not decoration: without it equal-overlap rows
    // come back in whatever order the plan produces and the module reshuffles
    // between renders for no visible reason.
    .orderBy(desc(mutualCount), asc(socialActors.id))
    .limit(limit);

  const suggestions: SuggestionSeed[] = shared.map((r) => ({
    ...r.actor,
    mutualCount: Number(r.mutualCount ?? 0),
  }));

  const remaining = limit - suggestions.length;
  if (remaining <= 0) {
    return annotateFollowsYou(actorId, suggestions);
  }

  const fresh = await db
    .select({ actor: publicActorColumns })
    .from(socialActors)
    .where(
      and(
        // Local only. "Recently joined" is a claim about this instance, and a
        // remote actor's createdAt is just when we first cached them.
        eq(socialActors.domain, socialConfig.domain),
        notInArray(socialActors.id, [actorId, ...suggestions.map((s) => s.id)]),
        notInArray(socialActors.id, alreadyAsked)
      )
    )
    .orderBy(desc(socialActors.createdAt), desc(socialActors.id))
    .limit(remaining);

  return annotateFollowsYou(
    actorId,
    suggestions.concat(fresh.map((r) => ({ ...r.actor, mutualCount: 0 })))
  );
}
