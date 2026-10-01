/**
 * Reading a group's roster.
 *
 * Separate from group.ts for the same reason block-filter.ts is separate from
 * block.ts: this is the read side, and the write side (approving requests,
 * changing roles, removing people) is a larger surface that will want its own
 * file rather than a second thousand lines in the group lifecycle module.
 *
 * The gate these functions are written for lives in the route, not here. Every
 * function takes a group id and answers honestly about it; deciding whether
 * the asker is allowed to know is the caller's job, and is done once in
 * app/api/social/groups/[handle]/members so there is a single place to get it
 * wrong rather than one per function.
 *
 * @see docs/GROUPS-ROADMAP.md
 * @see app/mock/group
 */

import { db } from '@/lib/db';
import { socialActors, socialGroupMembers } from '@/lib/schema';
import type { SocialGroupRole } from '@/lib/schema';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

/**
 * How many members a single roster request may return.
 *
 * The dedicated members page pages through at this size. Capping here rather
 * than trusting the query string keeps a crafted ?limit=100000 from turning
 * the roster into a way to dump every actor in a large group in one request.
 */
export const MAX_ROSTER_PAGE = 50;

/**
 * Rows returned when a caller names no limit.
 *
 * Deliberately not shared with the client's card size: this is the server
 * being conservative about an unbounded request, that is a layout decision.
 * They happen to match today and are free to stop.
 */
const DEFAULT_ROSTER_LIMIT = 12;

export interface GroupMemberSummary {
  /** The membership row, not the actor -- phase 9 targets this. */
  id: string;
  actorId: string;
  handle: string;
  name: string;
  iconUrl: string | null;
  role: SocialGroupRole;
  /**
   * Null only for rows that predate a joined_at being recorded. Active rows
   * written by joinGroup and createGroup always set it.
   */
  joinedAt: Date | null;
}

export interface GroupRosterPage {
  members: GroupMemberSummary[];
  /** Active members in the whole group, not in this page. */
  total: number;
  /** Offset to ask for next, or null when this page is the last one. */
  nextOffset: number | null;
}

/**
 * Admins first, then moderators, then everyone else; oldest first within a
 * rank.
 *
 * Alphabetical would be easier to scan, but it buries the people you came to
 * the roster to find. The two questions a roster actually gets asked are "who
 * runs this" and "who else is here", and this ordering answers the first one
 * without a second query.
 */
const ROLE_THEN_SENIORITY = [
  sql`CASE ${socialGroupMembers.role}
        WHEN 'admin' THEN 0
        WHEN 'moderator' THEN 1
        ELSE 2
      END`,
  sql`${socialGroupMembers.joinedAt} ASC NULLS LAST`,
  // Ties broken by id so paging is stable. Without it two members who joined
  // in the same transaction can swap places between page 1 and page 2, and
  // one of them is then never shown.
  asc(socialGroupMembers.id),
];

const MEMBER_COLUMNS = {
  id: socialGroupMembers.id,
  actorId: socialActors.id,
  handle: socialActors.username,
  name: socialActors.name,
  iconUrl: socialActors.iconUrl,
  role: socialGroupMembers.role,
  joinedAt: socialGroupMembers.joinedAt,
};

/**
 * name is nullable on social_actors because a remote actor may omit it, but a
 * row with no label is not renderable. The handle always exists.
 */
function withDisplayName(row: { name: string | null; handle: string }): {
  name: string;
} {
  return { name: row.name ?? row.handle };
}

/**
 * One page of a group's active roster.
 *
 * 'active' only, and that filter is load-bearing twice over: a pending row is
 * somebody who asked and has not been let in, and listing them next to the
 * members would both overstate the group's size and tell every member who is
 * waiting at the door. A banned row is a tombstone kept so the person cannot
 * rejoin, and showing it would be worse still.
 */
export async function listGroupMembers(
  groupId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<GroupRosterPage> {
  const limit = Math.min(
    Math.max(1, Math.floor(options.limit ?? DEFAULT_ROSTER_LIMIT)),
    MAX_ROSTER_PAGE
  );
  const offset = Math.max(0, Math.floor(options.offset ?? 0));

  const where = and(
    eq(socialGroupMembers.groupId, groupId),
    eq(socialGroupMembers.status, 'active')
  );

  const rows = await db
    .select(MEMBER_COLUMNS)
    .from(socialGroupMembers)
    .innerJoin(socialActors, eq(socialActors.id, socialGroupMembers.actorId))
    .where(where)
    .orderBy(...ROLE_THEN_SENIORITY)
    .limit(limit)
    .offset(offset);

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(socialGroupMembers)
    .where(where);

  const members = rows.map((row) => ({ ...row, ...withDisplayName(row) }));

  return {
    members,
    total: count,
    // Advances by rows actually returned, not by `limit`. Those match on a
    // full page; on a short one, stepping by limit would skip past rows a
    // concurrent insert put just past the end.
    nextOffset:
      offset + members.length < count ? offset + members.length : null,
  };
}

/**
 * The group's admins and moderators.
 *
 * Deliberately NOT gated the way the roster is. A private group shows its
 * leaders to someone who cannot see anything else, because the one action
 * available to that person is asking to be let in, and a door with nobody
 * named on it is one nobody knocks on. The mock makes the same call: its
 * locked state keeps the rail's "Admins & mods" and drops the rest.
 *
 * Unpaginated on purpose. A group with enough moderators to need paging has a
 * different problem than this function.
 */
export async function listGroupLeaders(
  groupId: string
): Promise<GroupMemberSummary[]> {
  const rows = await db
    .select(MEMBER_COLUMNS)
    .from(socialGroupMembers)
    .innerJoin(socialActors, eq(socialActors.id, socialGroupMembers.actorId))
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.status, 'active'),
        inArray(socialGroupMembers.role, ['admin', 'moderator'])
      )
    )
    .orderBy(...ROLE_THEN_SENIORITY);

  return rows.map((row) => ({ ...row, ...withDisplayName(row) }));
}

/**
 * Who has asked to join and is still waiting.
 *
 * Kept out of the roster on purpose -- a pending row is somebody who asked and
 * has not been let in, and listing them beside the members would both
 * overstate the group's size and tell every member who is waiting at the door.
 * This is the one read that wants them, and it is for admins and moderators.
 *
 * Ordered oldest first: a queue, not a list. Whoever has waited longest is the
 * one most owed an answer.
 *
 * Unpaginated. A queue long enough to need paging is a group that has stopped
 * answering its requests, which a page size will not fix.
 */
export async function listPendingRequests(
  groupId: string
): Promise<GroupMemberSummary[]> {
  const rows = await db
    .select(MEMBER_COLUMNS)
    .from(socialGroupMembers)
    .innerJoin(socialActors, eq(socialActors.id, socialGroupMembers.actorId))
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.status, 'pending')
      )
    )
    .orderBy(asc(socialGroupMembers.createdAt), asc(socialGroupMembers.id));

  return rows.map((row) => ({ ...row, ...withDisplayName(row) }));
}

/**
 * Who has been banned.
 *
 * Admin and moderator only, and the only way to find a row to un-ban. Banned
 * rows are invisible everywhere else by design, which also makes them
 * impossible to undo without this.
 */
export async function listBannedMembers(
  groupId: string
): Promise<GroupMemberSummary[]> {
  const rows = await db
    .select(MEMBER_COLUMNS)
    .from(socialGroupMembers)
    .innerJoin(socialActors, eq(socialActors.id, socialGroupMembers.actorId))
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.status, 'banned')
      )
    )
    .orderBy(asc(socialGroupMembers.id));

  return rows.map((row) => ({ ...row, ...withDisplayName(row) }));
}
