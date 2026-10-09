import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { connectorCommitments, profiles } from '@/lib/schema';
import { HOUSES } from '@/lib/connectors/model';
import type { ConnectorLoad } from '@/lib/connectors/hours';
import type { CommitmentProgress, HouseId } from '@/lib/connectors/model';

/**
 * Commitments: what a connector is actually doing.
 *
 * These used to live inside `profiles.connector`. drizzle/0056 moved them out
 * because the admin console can now set a task for somebody, and the blob was
 * only ever safe while each row had exactly one writer. The old route said so
 * itself — "if a second writer ever appears, this needs to move to its own
 * table rather than grow a lock" — and this is that move.
 *
 * ## One row type, two origins
 *
 * A task staff put on your board and a commitment you made yourself are the
 * same thing to everyone downstream: something you are going to do, in a
 * house, by roughly when, at some stage of done. They differ only in who
 * asked, which is one nullable column rather than a second table.
 *
 * `assignedBy === null` means you wrote it. That is the common case, so it is
 * the cheap one to store.
 *
 * ## Who may do what
 *
 * Progress is the connector's, always. Staff can put something on your board;
 * they cannot tick it off for you, because the only person who knows whether
 * the zines got dropped off is the person who did or did not drop them off.
 *
 * Deletion splits the other way. You may delete what you wrote — changing
 * your mind about your own commitment is the point of having one. You may not
 * delete what staff assigned you, because a task you can remove is a task you
 * were never really given, and the programme would have no way to tell "done"
 * from "gone". Declining an assignment is a conversation, and it leaves the
 * row visible until somebody has it.
 */

const HOUSE_IDS = new Set<string>(HOUSES.map((h) => h.id));
const PROGRESS_VALUES: ReadonlySet<string> = new Set([
  'notSet',
  'inProgress',
  'done',
]);

export const WHAT_MAX = 500;
export const WHEN_MAX = 120;

/**
 * A guard against one person's board growing without bound, not a product
 * rule. Nobody is meant to hit it; if somebody does, something is wrong with
 * how they are using the page rather than with how much they are doing.
 */
export const MAX_COMMITMENTS = 200;

export interface ConnectorCommitment {
  id: string;
  what: string;
  /** Free text on purpose: "this month", "before the 14th", "Saturdays". */
  when: string | null;
  house: HouseId;
  progress: CommitmentProgress;
  createdAt: string;
  /** Rough size in minutes. `null` means nobody has estimated it. */
  estimatedMinutes: number | null;
  /** The user who set this as a task. `null` means self-authored. */
  assignedBy: string | null;
  assignedAt: string | null;
}

/** A commitment plus whose it is, for the programme-wide admin view. */
export interface ConnectorCommitmentWithOwner extends ConnectorCommitment {
  profileId: string;
  ownerName: string;
}

function isHouse(value: string): value is HouseId {
  return HOUSE_IDS.has(value);
}

export function isProgress(value: unknown): value is CommitmentProgress {
  return typeof value === 'string' && PROGRESS_VALUES.has(value);
}

/**
 * The database has CHECK constraints on both of these, so a bad value cannot
 * get in through this application. It can still be sitting in a row written
 * before the constraint existed, or put there by hand during support, so rows
 * that fail to make sense are dropped rather than rendered — the same thing
 * `parseConnector` does with a malformed membership blob, and for the same
 * reason: a dashboard showing a commitment in no house is worse than one
 * showing a commitment fewer.
 */
type Row = {
  id: string;
  what: string;
  when: string | null;
  house: string;
  progress: string;
  createdAt: Date;
  estimatedMinutes: number | null;
  assignedBy: string | null;
  assignedAt: Date | null;
};

function toCommitment(row: Row): ConnectorCommitment | null {
  if (!isHouse(row.house)) return null;
  if (!isProgress(row.progress)) return null;

  return {
    id: row.id,
    what: row.what,
    when: row.when,
    house: row.house,
    progress: row.progress,
    createdAt: row.createdAt.toISOString(),
    estimatedMinutes: row.estimatedMinutes,
    assignedBy: row.assignedBy,
    assignedAt: row.assignedAt?.toISOString() ?? null,
  };
}

/**
 * Everything one connector is carrying, oldest first.
 *
 * Oldest first because a board is read as a history of what you took on, and
 * re-ordering it by urgency would need a notion of urgency that free-text
 * "when" cannot supply.
 */
export async function listCommitments(
  profileId: string
): Promise<ConnectorCommitment[]> {
  const rows = await db
    .select({
      id: connectorCommitments.id,
      what: connectorCommitments.what,
      when: connectorCommitments.when,
      house: connectorCommitments.house,
      progress: connectorCommitments.progress,
      createdAt: connectorCommitments.createdAt,
      estimatedMinutes: connectorCommitments.estimatedMinutes,
      assignedBy: connectorCommitments.assignedBy,
      assignedAt: connectorCommitments.assignedAt,
    })
    .from(connectorCommitments)
    .where(eq(connectorCommitments.profileId, profileId))
    .orderBy(asc(connectorCommitments.createdAt));

  return rows
    .map(toCommitment)
    .filter((c): c is ConnectorCommitment => c !== null);
}

export async function countCommitments(profileId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(connectorCommitments)
    .where(eq(connectorCommitments.profileId, profileId));

  return row?.count ?? 0;
}

export interface NewCommitment {
  profileId: string;
  what: string;
  when: string | null;
  house: HouseId;
  /** Rough size in minutes. Omit when nobody has estimated it. */
  estimatedMinutes?: number | null;
  /** Omit for a self-authored commitment; pass a user id for a staff task. */
  assignedBy?: string | null;
}

/**
 * Add a commitment, or assign one.
 *
 * `assignedAt` is set here rather than by the caller so that the pair cannot
 * come apart — the table has a CHECK requiring both halves or neither, and
 * the single place that can violate it is the single place that writes it.
 */
export async function createCommitment(
  input: NewCommitment
): Promise<ConnectorCommitment> {
  const assignedBy = input.assignedBy ?? null;
  const estimatedMinutes = input.estimatedMinutes ?? null;
  const now = new Date();

  const row = {
    id: createId(),
    profileId: input.profileId,
    what: input.what,
    when: input.when,
    house: input.house,
    progress: 'notSet' as const,
    estimatedMinutes,
    assignedBy,
    assignedAt: assignedBy ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(connectorCommitments).values(row);

  return {
    id: row.id,
    what: row.what,
    when: row.when,
    house: input.house,
    progress: 'notSet',
    createdAt: now.toISOString(),
    estimatedMinutes,
    assignedBy,
    assignedAt: assignedBy ? now.toISOString() : null,
  };
}

/**
 * Move one of your own commitments along.
 *
 * Scoped by `profileId` in the WHERE rather than fetched and checked, so there
 * is no window between the check and the write, and so a guessed id belonging
 * to somebody else updates nothing instead of updating theirs. Returns false
 * when nothing matched, which the route turns into a 404.
 *
 * Applies to assigned tasks too: staff set what you are doing, you say how
 * far along it is.
 */
export async function setCommitmentProgress(
  profileId: string,
  commitmentId: string,
  progress: CommitmentProgress
): Promise<boolean> {
  const updated = await db
    .update(connectorCommitments)
    .set({ progress, updatedAt: new Date() })
    .where(
      and(
        eq(connectorCommitments.id, commitmentId),
        eq(connectorCommitments.profileId, profileId)
      )
    )
    .returning({ id: connectorCommitments.id });

  return updated.length > 0;
}

/**
 * Delete one of your own commitments.
 *
 * The `assignedBy IS NULL` clause is the rule, enforced in the WHERE: you can
 * drop what you wrote, not what you were asked to do. A connector trying to
 * delete an assigned task matches no row and gets the same "could not find
 * that" as a bad id — which is honest, because as far as this operation is
 * concerned there is nothing there to delete.
 */
export async function removeOwnCommitment(
  profileId: string,
  commitmentId: string
): Promise<boolean> {
  const deleted = await db
    .delete(connectorCommitments)
    .where(
      and(
        eq(connectorCommitments.id, commitmentId),
        eq(connectorCommitments.profileId, profileId),
        sql`${connectorCommitments.assignedBy} IS NULL`
      )
    )
    .returning({ id: connectorCommitments.id });

  return deleted.length > 0;
}

/** Staff removing a task they set. Not scoped to an owner — see the module docblock. */
export async function removeCommitmentAsStaff(
  commitmentId: string
): Promise<boolean> {
  const deleted = await db
    .delete(connectorCommitments)
    .where(eq(connectorCommitments.id, commitmentId))
    .returning({ id: connectorCommitments.id });

  return deleted.length > 0;
}

/**
 * Does this commitment exist on this person's board, and who put it there?
 *
 * Only for telling a failed write apart from a forbidden one after the fact.
 * The writes above enforce ownership in their own WHERE clauses, so this is
 * never the thing granting access — calling it first and then trusting the
 * answer would reintroduce exactly the gap those clauses close. It runs after
 * a write has already declined, purely so the member is told "that one was
 * assigned to you" instead of "not found".
 */
export async function findCommitment(
  profileId: string,
  commitmentId: string
): Promise<{ assignedBy: string | null } | null> {
  const [row] = await db
    .select({ assignedBy: connectorCommitments.assignedBy })
    .from(connectorCommitments)
    .where(
      and(
        eq(connectorCommitments.id, commitmentId),
        eq(connectorCommitments.profileId, profileId)
      )
    )
    .limit(1);

  return row ?? null;
}

/**
 * Everything the programme is carrying that is not finished, newest first.
 *
 * Newest first here, unlike a personal board: staff are looking for what has
 * just been taken on and what is piling up, not reading one person's history.
 * Capped because this is a dashboard panel rather than a report — if the
 * programme ever has more open commitments than fit, the answer is a filter,
 * not a longer page.
 */
export async function listOpenCommitments(
  limit = 50
): Promise<ConnectorCommitmentWithOwner[]> {
  const rows = await db
    .select({
      id: connectorCommitments.id,
      what: connectorCommitments.what,
      when: connectorCommitments.when,
      house: connectorCommitments.house,
      progress: connectorCommitments.progress,
      createdAt: connectorCommitments.createdAt,
      estimatedMinutes: connectorCommitments.estimatedMinutes,
      assignedBy: connectorCommitments.assignedBy,
      assignedAt: connectorCommitments.assignedAt,
      profileId: connectorCommitments.profileId,
      name: profiles.name,
      screenname: profiles.screenname,
      email: profiles.email,
    })
    .from(connectorCommitments)
    .innerJoin(profiles, eq(profiles.id, connectorCommitments.profileId))
    .where(ne(connectorCommitments.progress, 'done'))
    .orderBy(desc(connectorCommitments.createdAt))
    .limit(limit);

  return rows.flatMap((row) => {
    const base = toCommitment(row);
    if (!base) return [];
    return [
      {
        ...base,
        profileId: row.profileId,
        ownerName:
          row.name.trim() || row.screenname?.trim() || row.email.split('@')[0],
      },
    ];
  });
}

/**
 * How many commitments the programme is carrying, split by state.
 *
 * One grouped query rather than three counts, so the three numbers cannot
 * disagree with each other — which is the whole promise the admin page makes
 * about its stat band.
 */
export async function commitmentTotals(): Promise<{
  total: number;
  open: number;
  done: number;
  assigned: number;
}> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${connectorCommitments.progress} = 'done')::int`,
      assigned: sql<number>`count(*) filter (where ${connectorCommitments.assignedBy} is not null)::int`,
    })
    .from(connectorCommitments);

  const total = row?.total ?? 0;
  const done = row?.done ?? 0;

  return { total, open: total - done, done, assigned: row?.assigned ?? 0 };
}

/**
 * How much each connector is carrying, keyed by profile.
 *
 * One grouped query over the open rows, for the same reason `commitmentTotals`
 * is one query: three numbers derived separately can disagree, and this set
 * gets rendered as a single sentence about a person.
 *
 * `SUM ... FILTER` and `COUNT ... FILTER` split the sized work from the
 * unsized in the database rather than in a loop here, so a connector whose
 * commitments were all written before drizzle/0059 comes back as
 * `{ open: 4, estimatedMinutes: 0, unestimated: 4 }` — visibly incomplete,
 * rather than as somebody with four things and no work.
 *
 * Returns a Map rather than an array because every caller has a roster in hand
 * and wants to look people up by id. Connectors with nothing open are absent;
 * `EMPTY_LOAD` is the caller's default, which keeps "carrying nothing" and
 * "not in the result" the same thing at the point of use.
 */
export async function connectorLoads(): Promise<Map<string, ConnectorLoad>> {
  const rows = await db
    .select({
      profileId: connectorCommitments.profileId,
      open: sql<number>`count(*)::int`,
      estimatedMinutes: sql<number>`coalesce(sum(${connectorCommitments.estimatedMinutes}), 0)::int`,
      unestimated: sql<number>`(count(*) filter (where ${connectorCommitments.estimatedMinutes} is null))::int`,
    })
    .from(connectorCommitments)
    .where(ne(connectorCommitments.progress, 'done'))
    .groupBy(connectorCommitments.profileId);

  return new Map(
    rows.map((row) => [
      row.profileId,
      {
        open: row.open,
        estimatedMinutes: row.estimatedMinutes,
        unestimated: row.unestimated,
      },
    ])
  );
}
