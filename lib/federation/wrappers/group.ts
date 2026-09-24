/**
 * Group Lifecycle
 *
 * Creating a group, and getting in and out of one.
 *
 * A group is an actor. Creating one mints a real social_actors row with
 * type='Group' and its own signing keypair, so everything the federation layer
 * already does for people -- signing, addressing, delivery, WebFinger, the
 * actor endpoint -- works for a group with no special casing. The alternative
 * was a parallel delivery path for groups, which would have to reimplement all
 * of that and then drift from it.
 *
 * @see docs/GROUPS-ROADMAP.md
 */

import { db } from '@/lib/db';
import {
  socialActors,
  socialGroups,
  socialGroupMembers,
  toPublicActor,
} from '@/lib/schema';
import type {
  PublicSocialActor,
  SocialGroup,
  SocialGroupMember,
  SocialGroupJoinPolicy,
  SocialGroupRole,
  SocialGroupVisibility,
} from '@/lib/schema';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { generateActorKeyPair } from '../crypto/keys';
import { validateScreennameFull } from '@/lib/screenname';
import {
  socialConfig,
  getActorUrl,
  getInboxUrl,
  getOutboxUrl,
  getFollowersUrl,
  getFollowingUrl,
} from '../index';

/**
 * Caps on the two free-form lists. Both are rendered in full on the group
 * page, and both are written by whoever runs the group rather than by staff,
 * so they need an upper bound that is generous for real use and useless for
 * abuse.
 */
export const MAX_GROUP_TOPICS = 12;
export const MAX_GROUP_RULES = 20;
export const MAX_GROUP_RULE_LENGTH = 280;
export const MAX_GROUP_NAME_LENGTH = 80;
export const MAX_GROUP_SUMMARY_LENGTH = 500;

export interface CreateGroupInput {
  /** The group's handle. Shares the flat namespace with people and listings. */
  handle: string;
  name: string;
  summary?: string;
  topics?: string[];
  rules?: string[];
  visibility?: SocialGroupVisibility;
  joinPolicy?: SocialGroupJoinPolicy;
  /** The profile starting the group, recorded for moderation history. */
  createdByProfileId: string;
  /** The actor starting the group. Becomes its first admin. */
  founderActorId: string;
}

export type CreateGroupResult =
  | { success: true; group: SocialGroup; actor: PublicSocialActor }
  | { success: false; error: string };

export type JoinGroupResult =
  | { success: true; membership: SocialGroupMember; pending: boolean }
  | { success: false; error: string };

export type LeaveGroupResult =
  { success: true; left: true } | { success: false; error: string };

/**
 * Turn a topic list into the `{ topic: true }` flag map the column stores.
 *
 * Lowercased and de-duplicated on the way in, because the map's keys ARE the
 * identity of a topic -- "Printmaking" and "printmaking" would otherwise be
 * two different facets that never match each other in search.
 */
function toTopicFlags(topics: string[]): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const raw of topics) {
    const topic = raw.trim().toLowerCase();
    if (topic) flags[topic] = true;
  }
  return flags;
}

/**
 * Create a group, its actor, and its founding admin membership.
 */
export async function createGroup(
  input: CreateGroupInput
): Promise<CreateGroupResult> {
  const handle = input.handle.trim();
  const name = input.name.trim();

  if (!name) {
    return { success: false, error: 'A group name is required' };
  }

  if (name.length > MAX_GROUP_NAME_LENGTH) {
    return {
      success: false,
      error: `A group name must be no more than ${MAX_GROUP_NAME_LENGTH} characters`,
    };
  }

  const summary = input.summary?.trim() || undefined;
  if (summary && summary.length > MAX_GROUP_SUMMARY_LENGTH) {
    return {
      success: false,
      error: `A group description must be no more than ${MAX_GROUP_SUMMARY_LENGTH} characters`,
    };
  }

  const topics = input.topics ?? [];
  if (topics.length > MAX_GROUP_TOPICS) {
    return {
      success: false,
      error: `A group can have at most ${MAX_GROUP_TOPICS} topics`,
    };
  }

  const rules = (input.rules ?? []).map((r) => r.trim()).filter(Boolean);
  if (rules.length > MAX_GROUP_RULES) {
    return {
      success: false,
      error: `A group can have at most ${MAX_GROUP_RULES} rules`,
    };
  }
  if (rules.some((r) => r.length > MAX_GROUP_RULE_LENGTH)) {
    return {
      success: false,
      error: `A rule must be no more than ${MAX_GROUP_RULE_LENGTH} characters`,
    };
  }

  // The handle goes through the same validator people and listings use, so a
  // group cannot take a name a pana already answers to. See lib/screenname.ts.
  const handleCheck = await validateScreennameFull(handle);
  if (!handleCheck.valid) {
    return { success: false, error: handleCheck.error ?? 'Invalid handle' };
  }

  const { publicKey, privateKey } = generateActorKeyPair();

  // One transaction: an actor with no group row is unusable and invisible, and
  // a group with no admin cannot be administered. Either all three rows land
  // or none do.
  const created = await db.transaction(async (tx) => {
    const [actor] = await tx
      .insert(socialActors)
      .values({
        username: handle,
        domain: socialConfig.domain,
        type: 'Group',
        // Deliberately null. A group is not a directory listing and has no
        // profile; social_actors.profile_id is unique but nullable, and
        // Postgres permits any number of NULLs in a unique index.
        profileId: null,
        uri: getActorUrl(handle),
        inboxUrl: getInboxUrl(handle),
        outboxUrl: getOutboxUrl(handle),
        followersUrl: getFollowersUrl(handle),
        followingUrl: getFollowingUrl(handle),
        publicKey,
        privateKey,
        name,
        summary,
      })
      .returning();

    const [group] = await tx
      .insert(socialGroups)
      .values({
        actorId: actor.id,
        createdByProfileId: input.createdByProfileId,
        topics: toTopicFlags(topics),
        rules,
        visibility: input.visibility ?? 'public',
        joinPolicy: input.joinPolicy ?? 'open',
        // The founder, counted immediately rather than left for the insert
        // below to increment.
        memberCount: 1,
      })
      .returning();

    await tx.insert(socialGroupMembers).values({
      groupId: group.id,
      actorId: input.founderActorId,
      role: 'admin',
      status: 'active',
      joinedAt: new Date(),
    });

    return { group, actor };
  });

  return {
    success: true,
    group: created.group,
    actor: toPublicActor(created.actor),
  };
}

/**
 * Join a group, or ask to.
 *
 * Idempotent: a repeat call returns the membership that already exists rather
 * than creating a second one or inflating member_count. The unique index on
 * (group_id, actor_id) is the backstop if two calls race.
 */
export async function joinGroup(
  groupId: string,
  actorId: string
): Promise<JoinGroupResult> {
  const group = await db.query.socialGroups.findFirst({
    where: eq(socialGroups.id, groupId),
  });

  if (!group) {
    return { success: false, error: 'Group not found' };
  }

  const existing = await db.query.socialGroupMembers.findFirst({
    where: and(
      eq(socialGroupMembers.groupId, groupId),
      eq(socialGroupMembers.actorId, actorId)
    ),
  });

  if (existing) {
    // A ban is enforced by the row's continued existence. Returning the same
    // generic message as a normal refusal would tell a banned pana nothing
    // useful, so it is explicit -- they already know.
    if (existing.status === 'banned') {
      return { success: false, error: 'You have been removed from this group' };
    }
    return {
      success: true,
      membership: existing,
      pending: existing.status === 'pending',
    };
  }

  if (group.joinPolicy === 'invite') {
    return { success: false, error: 'This group is invite only' };
  }

  const pending = group.joinPolicy === 'request';

  const membership = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(socialGroupMembers)
      .values({
        groupId,
        actorId,
        role: 'member',
        status: pending ? 'pending' : 'active',
        // Null while pending, so "member since" never claims someone joined on
        // the day they merely asked.
        joinedAt: pending ? null : new Date(),
      })
      .returning();

    // Only active memberships are counted, so a request changes nothing here.
    if (!pending) {
      await tx
        .update(socialGroups)
        .set({ memberCount: sql`${socialGroups.memberCount} + 1` })
        .where(eq(socialGroups.id, groupId));
    }

    return row;
  });

  return { success: true, membership, pending };
}

/**
 * Leave a group, or withdraw a pending request.
 */
export async function leaveGroup(
  groupId: string,
  actorId: string
): Promise<LeaveGroupResult> {
  const membership = await db.query.socialGroupMembers.findFirst({
    where: and(
      eq(socialGroupMembers.groupId, groupId),
      eq(socialGroupMembers.actorId, actorId)
    ),
  });

  if (!membership) {
    return { success: false, error: 'You are not a member of this group' };
  }

  // Deleting a ban row would let the banned pana walk straight back into an
  // open group, so leaving is not a way out of one.
  if (membership.status === 'banned') {
    return { success: false, error: 'You have been removed from this group' };
  }

  // A group with no admin can never approve a request, change a setting or be
  // deleted -- it is stranded. Refuse rather than create one.
  if (membership.role === 'admin' && membership.status === 'active') {
    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(socialGroupMembers)
      .where(
        and(
          eq(socialGroupMembers.groupId, groupId),
          eq(socialGroupMembers.role, 'admin'),
          eq(socialGroupMembers.status, 'active'),
          ne(socialGroupMembers.actorId, actorId)
        )
      );

    if (count === 0) {
      return {
        success: false,
        error:
          'You are the only admin. Make someone else an admin before leaving.',
      };
    }
  }

  const wasActive = membership.status === 'active';

  await db.transaction(async (tx) => {
    await tx
      .delete(socialGroupMembers)
      .where(eq(socialGroupMembers.id, membership.id));

    if (wasActive) {
      // GREATEST guards the count against ever going negative if it has
      // already drifted, which is cheaper than reconciling it here.
      await tx
        .update(socialGroups)
        .set({
          memberCount: sql`GREATEST(${socialGroups.memberCount} - 1, 0)`,
        })
        .where(eq(socialGroups.id, groupId));
    }
  });

  return { success: true, left: true };
}

/**
 * Get a group by its actor's handle, with the actor attached.
 */
export async function getGroupByHandle(handle: string) {
  const actor = await db.query.socialActors.findFirst({
    where: (a, { and: andOp, eq: eqOp }) =>
      andOp(
        eqOp(a.username, handle),
        eqOp(a.domain, socialConfig.domain),
        eqOp(a.type, 'Group')
      ),
    with: { group: true },
  });

  if (!actor?.group) return null;

  // Strip the joined relation before it reaches a response: the group is
  // already returned alongside, and leaving it nested duplicates every field.
  const { group, ...actorRow } = actor;

  return { group, actor: toPublicActor(actorRow) };
}

/**
 * The membership row linking an actor to a group, or null.
 *
 * Callers use this to answer "may this viewer read a private group" and "what
 * does the toolbar say", so it returns pending and banned rows too rather than
 * filtering to active.
 */
export async function getMembership(
  groupId: string,
  actorId: string
): Promise<SocialGroupMember | null> {
  return (
    (await db.query.socialGroupMembers.findFirst({
      where: and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.actorId, actorId)
      ),
    })) ?? null
  );
}

export interface PublicGroupMembership {
  id: string;
  handle: string;
  name: string;
  summary: string | null;
  iconUrl: string | null;
  memberCount: number;
}

/**
 * Public groups an actor is an active member of.
 *
 * Feeds the Groups stat in the feed rail and the group cards on a profile, so
 * it is read by anyone looking at anyone -- which is exactly why both filters
 * below are load-bearing:
 *
 *   - visibility 'public' only. A private group appearing on someone's public
 *     profile tells a stranger both that the group exists and that this
 *     person is in it. That is a membership disclosure the person never
 *     agreed to, and it is the reason GroupCard can safely render no privacy
 *     marker at all.
 *   - status 'active' only. A pending request is not a membership, and
 *     showing it would advertise that someone asked to join somewhere before
 *     the admins have decided.
 */
export async function listPublicGroupsForActor(
  actorId: string
): Promise<PublicGroupMembership[]> {
  const rows = await db
    .select({
      id: socialGroups.id,
      handle: socialActors.username,
      name: socialActors.name,
      summary: socialActors.summary,
      iconUrl: socialActors.iconUrl,
      memberCount: socialGroups.memberCount,
    })
    .from(socialGroupMembers)
    .innerJoin(socialGroups, eq(socialGroups.id, socialGroupMembers.groupId))
    .innerJoin(socialActors, eq(socialActors.id, socialGroups.actorId))
    .where(
      and(
        eq(socialGroupMembers.actorId, actorId),
        eq(socialGroupMembers.status, 'active'),
        eq(socialGroups.visibility, 'public')
      )
    )
    .orderBy(asc(socialActors.name));

  // name is nullable on social_actors because remote actors may omit it, but
  // a card with no title is not renderable -- fall back to the handle, which
  // always exists.
  return rows.map((row) => ({
    ...row,
    name: row.name ?? row.handle,
  }));
}

export interface MyGroupMembership extends PublicGroupMembership {
  visibility: SocialGroupVisibility;
  joinPolicy: SocialGroupJoinPolicy;
  role: SocialGroupRole;
}

/**
 * Every group an actor is an active member of, private ones included.
 *
 * The deliberate opposite of listPublicGroupsForActor, and the two must never
 * be swapped. That one answers "what may a stranger know about this person",
 * so it hides private groups; this one answers "where do I belong", asked by
 * the member about themselves. Hiding a private group from its own member is
 * not privacy, it is a missing group -- they would have no way back to a room
 * they are standing in.
 *
 * Because of that, every caller must already have established that the viewer
 * IS this actor. There is no viewerActorId parameter to get wrong: the route
 * resolves the actor from the session and passes only that.
 *
 * Still 'active' only. A pending request is not yet a membership, and listing
 * it under "your groups" would promise access that the admins have not
 * granted.
 */
export async function listMyGroups(
  actorId: string
): Promise<MyGroupMembership[]> {
  const rows = await db
    .select({
      id: socialGroups.id,
      handle: socialActors.username,
      name: socialActors.name,
      summary: socialActors.summary,
      iconUrl: socialActors.iconUrl,
      memberCount: socialGroups.memberCount,
      visibility: socialGroups.visibility,
      joinPolicy: socialGroups.joinPolicy,
      role: socialGroupMembers.role,
    })
    .from(socialGroupMembers)
    .innerJoin(socialGroups, eq(socialGroups.id, socialGroupMembers.groupId))
    .innerJoin(socialActors, eq(socialActors.id, socialGroups.actorId))
    .where(
      and(
        eq(socialGroupMembers.actorId, actorId),
        eq(socialGroupMembers.status, 'active')
      )
    )
    .orderBy(asc(socialActors.name));

  return rows.map((row) => ({
    ...row,
    name: row.name ?? row.handle,
  }));
}
