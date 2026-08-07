import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import {
  profiles,
  users,
  relayGroups,
  relayGroupMembers,
  relayGroupInvites,
} from '@/lib/schema';
import type { RelayGroupJoinPolicy } from '@/lib/schema';
import { maturedLeaveExists } from '@/lib/relay/group-maturation';
import { matureAndSettle } from '@/lib/relay/group-lifecycle';

// Read helpers shared by the /r/groups pages and the /api/relay/groups routes.
// Everything here is scoped to one caller: the API layer is responsible for
// authentication, this layer for "what may this pubkey see".
//
// Membership lives in pubkey space (relay_group_members) while accounts live in
// user space (users, profiles). profiles.nostr_pubkey is the only bridge, and
// it is nullable — an unenrolled member has no pubkey and therefore cannot be
// in any group. Every function here takes the pubkey, never a user id, so that
// asymmetry stays visible at the call site.

// How long an unanswered invite stays live before it stops counting.
export const INVITE_TTL_DAYS = 30;

export interface GroupSummary {
  groupId: string;
  name: string;
  about: string | null;
  picture: string | null;
  joinPolicy: RelayGroupJoinPolicy;
  memberCount: number;
  // Whether the viewer holds creator rights (metadata edits, invites). The UI
  // shows the affordances this unlocks but never names a "creator" role.
  canManage: boolean;
  // NULL created_by marks a panamia-provisioned group. Those cannot be edited
  // or dissolved by members, and are exempt from delete-when-empty.
  systemProvisioned: boolean;
}

export interface GroupMemberSummary {
  pubkey: string;
  joinedAt: Date;
  screenname: string | null;
  name: string | null;
  // True for the row belonging to the viewer.
  isSelf: boolean;
}

// Resolve the caller's Nostr identity. Returns null when the account exists but
// has not enrolled — every group action requires a pubkey, so callers treat
// null as "send them to /r to enroll first" rather than as an error.
export async function getCallerPubkey(userId: string): Promise<string | null> {
  const [profile] = await db
    .select({ nostrPubkey: profiles.nostrPubkey })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return profile?.nostrPubkey ?? null;
}

// Member counts for a set of groups, in one query. Counting per-group in a
// loop is what this exists to avoid — the groups list renders every group the
// caller belongs to.
async function memberCounts(groupIds: string[]): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map();
  const rows = await db
    .select({
      groupId: relayGroupMembers.groupId,
      total: sql<number>`count(*)`,
    })
    .from(relayGroupMembers)
    .where(
      and(
        inArray(relayGroupMembers.groupId, groupIds),
        sql`NOT EXISTS (${maturedLeaveExists})`
      )
    )
    .groupBy(relayGroupMembers.groupId);
  return new Map(rows.map((r) => [r.groupId, Number(r.total)]));
}

// Every group this pubkey belongs to.
//
// Maturation runs first, per group: a leave that outlived the debounce window
// must stop counting before the roster is read, and that same sweep is what
// dissolves a group whose last member has gone. Skipping it would show the
// caller groups they have already left.
export async function listGroupsForPubkey(
  pubkey: string
): Promise<GroupSummary[]> {
  const candidates = await db
    .select({ groupId: relayGroupMembers.groupId })
    .from(relayGroupMembers)
    .where(eq(relayGroupMembers.pubkey, pubkey));

  for (const { groupId } of candidates) {
    await matureAndSettle(db, groupId);
  }

  const rows = await db
    .select({
      groupId: relayGroups.groupId,
      name: relayGroups.name,
      about: relayGroups.about,
      picture: relayGroups.picture,
      joinPolicy: relayGroups.joinPolicy,
      createdBy: relayGroups.createdBy,
    })
    .from(relayGroupMembers)
    .innerJoin(relayGroups, eq(relayGroups.groupId, relayGroupMembers.groupId))
    .where(
      and(
        eq(relayGroupMembers.pubkey, pubkey),
        sql`NOT EXISTS (${maturedLeaveExists})`
      )
    )
    .orderBy(asc(relayGroups.name));

  const counts = await memberCounts(rows.map((r) => r.groupId));

  return rows.map((r) => ({
    groupId: r.groupId,
    name: r.name,
    about: r.about,
    picture: r.picture,
    joinPolicy: r.joinPolicy,
    memberCount: counts.get(r.groupId) ?? 0,
    canManage: r.createdBy === pubkey,
    systemProvisioned: r.createdBy === null,
  }));
}

// Open groups the caller is not already in, for /r/groups/browse.
//
// Only join_policy = 'open' is listed. Invite-only groups are absent by
// design: their existence is not advertised here, matching the relay, which
// skips public kind-39000 emission for them (discoverable is derived from the
// same flag).
export async function listOpenGroups(
  pubkey: string | null
): Promise<GroupSummary[]> {
  const rows = await db
    .select({
      groupId: relayGroups.groupId,
      name: relayGroups.name,
      about: relayGroups.about,
      picture: relayGroups.picture,
      joinPolicy: relayGroups.joinPolicy,
      createdBy: relayGroups.createdBy,
    })
    .from(relayGroups)
    .where(eq(relayGroups.joinPolicy, 'open'))
    .orderBy(asc(relayGroups.name));

  const counts = await memberCounts(rows.map((r) => r.groupId));

  const mine = pubkey
    ? new Set(
        (
          await db
            .select({ groupId: relayGroupMembers.groupId })
            .from(relayGroupMembers)
            .where(eq(relayGroupMembers.pubkey, pubkey))
        ).map((r) => r.groupId)
      )
    : new Set<string>();

  return rows
    .filter((r) => !mine.has(r.groupId))
    .map((r) => ({
      groupId: r.groupId,
      name: r.name,
      about: r.about,
      picture: r.picture,
      joinPolicy: r.joinPolicy,
      memberCount: counts.get(r.groupId) ?? 0,
      canManage: false,
      systemProvisioned: r.createdBy === null,
    }));
}

// One group, as seen by this pubkey. Returns null when the group does not
// exist, and also when it is invite-only and the caller is not a member.
//
// The two cases are indistinguishable to the caller, but do NOT read that as
// concealment: hide-entirely is deferred on the relay (see "Hide-entirely is
// deferred" in docs/RESILIENCE-ROADMAP.md), so a Nostr client can still learn
// that a group id exists. This is "nothing here for you", not a secret. If the
// relay ever gains the hide-entirely upgrade, this becomes load-bearing.
export async function getGroupForPubkey(
  groupId: string,
  pubkey: string | null
): Promise<(GroupSummary & { isMember: boolean }) | null> {
  await matureAndSettle(db, groupId);

  const [group] = await db
    .select()
    .from(relayGroups)
    .where(eq(relayGroups.groupId, groupId))
    .limit(1);

  if (!group) return null;

  const isMember = pubkey
    ? (
        await db
          .select({ exists: sql<number>`1` })
          .from(relayGroupMembers)
          .where(
            and(
              eq(relayGroupMembers.groupId, groupId),
              eq(relayGroupMembers.pubkey, pubkey),
              sql`NOT EXISTS (${maturedLeaveExists})`
            )
          )
          .limit(1)
      ).length > 0
    : false;

  if (!isMember && group.joinPolicy !== 'open') return null;

  const counts = await memberCounts([groupId]);

  return {
    groupId: group.groupId,
    name: group.name,
    about: group.about,
    picture: group.picture,
    joinPolicy: group.joinPolicy,
    memberCount: counts.get(groupId) ?? 0,
    canManage: group.createdBy === pubkey,
    systemProvisioned: group.createdBy === null,
    isMember,
  };
}

// Roster with display names attached. A member whose profile has no screenname
// — or who enrolled a pubkey that no longer maps to a profile at all — still
// appears, as a row with null names; the UI falls back to a truncated npub so
// nobody silently vanishes from the list.
export async function listGroupMembers(
  groupId: string,
  viewerPubkey: string | null
): Promise<GroupMemberSummary[]> {
  const rows = await db
    .select({
      pubkey: relayGroupMembers.pubkey,
      joinedAt: relayGroupMembers.joinedAt,
      screenname: users.screenname,
      name: profiles.name,
    })
    .from(relayGroupMembers)
    .leftJoin(profiles, eq(profiles.nostrPubkey, relayGroupMembers.pubkey))
    .leftJoin(users, eq(users.id, profiles.userId))
    .where(
      and(
        eq(relayGroupMembers.groupId, groupId),
        sql`NOT EXISTS (${maturedLeaveExists})`
      )
    )
    .orderBy(asc(relayGroupMembers.joinedAt));

  return rows.map((r) => ({
    pubkey: r.pubkey,
    joinedAt: r.joinedAt,
    screenname: r.screenname,
    name: r.name,
    isSelf: r.pubkey === viewerPubkey,
  }));
}

export interface PendingInvite {
  id: string;
  groupId: string;
  groupName: string;
  groupAbout: string | null;
  invitedByScreenname: string | null;
  createdAt: Date;
  expiresAt: Date;
}

// Invitations awaiting this user's answer. Keyed by user id, not pubkey: an
// invite can be sent to someone who has not enrolled yet, and they need to see
// it in order to know enrolling is worth doing.
export async function listPendingInvites(
  userId: string
): Promise<PendingInvite[]> {
  // The invite row points at two accounts; only the sender is joined here.
  const inviter = alias(users, 'inviter');
  const rows = await db
    .select({
      id: relayGroupInvites.id,
      groupId: relayGroupInvites.groupId,
      groupName: relayGroups.name,
      groupAbout: relayGroups.about,
      invitedByScreenname: inviter.screenname,
      createdAt: relayGroupInvites.createdAt,
      expiresAt: relayGroupInvites.expiresAt,
    })
    .from(relayGroupInvites)
    .innerJoin(relayGroups, eq(relayGroups.groupId, relayGroupInvites.groupId))
    .leftJoin(inviter, eq(inviter.id, relayGroupInvites.invitedByUserId))
    .where(
      and(
        eq(relayGroupInvites.invitedUserId, userId),
        gt(relayGroupInvites.expiresAt, new Date())
      )
    )
    .orderBy(desc(relayGroupInvites.createdAt));

  return rows;
}

// Look up an invitee by screenname. Returns only accounts that could actually
// receive an invite — screenname set and not the inviter themselves. Enrollment
// is NOT required here: an unenrolled member can accept later, after enrolling.
export async function findInviteeByScreenname(
  screenname: string
): Promise<{ userId: string; screenname: string } | null> {
  const [row] = await db
    .select({ userId: users.id, screenname: users.screenname })
    .from(users)
    .where(
      and(
        sql`lower(${users.screenname}) = lower(${screenname})`,
        isNotNull(users.screenname)
      )
    )
    .limit(1);
  return row?.screenname
    ? { userId: row.userId, screenname: row.screenname }
    : null;
}
