import { and, asc, desc, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { connectorEvents } from '@/lib/schema';
import { PODS } from '@/lib/connectors/model';
import type { PodId } from '@/lib/connectors/model';

/**
 * Programme gatherings, as data.
 *
 * 0055 left these out deliberately and said why: there was nowhere real to
 * put them, so HQ deleted its events panel rather than keep rendering invented
 * ones. drizzle/0057 built the home; this reads and writes it.
 *
 * ## Upcoming is a sort, which is why starts_at is a timestamp
 *
 * The mock stored when as free text — "Thursdays @ 5p" — which reads well and
 * orders not at all. A panel called "coming up" is nothing but an ordering and
 * a cutoff, so the next occurrence is a real instant and the repeat is
 * described separately.
 *
 * ## Nothing rolls itself forward
 *
 * A weekly event whose date has passed stays passed until a human moves it.
 * That is the point: an event that silently reschedules itself keeps looking
 * healthy long after the last person stopped coming, and the programme would
 * have no signal that it had died. `staleRecurring` surfaces exactly those
 * rows to staff instead, where somebody has to decide whether the next one is
 * happening.
 */

export type Cadence = 'once' | 'weekly' | 'weekends' | 'monthly';

export const CADENCES: readonly Cadence[] = [
  'once',
  'weekly',
  'weekends',
  'monthly',
];

export const CADENCE_LABEL: Record<Cadence, string> = {
  once: 'One-time',
  weekly: 'Weekly',
  weekends: 'Weekends',
  monthly: 'Monthly',
};

const CADENCE_VALUES: ReadonlySet<string> = new Set(CADENCES);
const POD_IDS = new Set<string>(PODS.map((p) => p.id));

export const TITLE_MAX = 160;
export const LOCATION_MAX = 200;
export const DETAILS_MAX = 1000;

export function isCadence(value: unknown): value is Cadence {
  return typeof value === 'string' && CADENCE_VALUES.has(value);
}

export function isPod(value: unknown): value is PodId {
  return typeof value === 'string' && POD_IDS.has(value);
}

export interface ConnectorEvent {
  id: string;
  title: string;
  details: string | null;
  /** ISO. The next or only occurrence, and the sort key. */
  startsAt: string;
  /** Human phrasing: "Thursdays @ 5p". `null` renders as just the date. */
  when: string | null;
  location: string | null;
  cadence: Cadence;
  volunteersNeeded: number | null;
  /** `null` means programme-wide. */
  pod: PodId | null;
  /** Who is running it. A name, not a member reference. */
  lead: string | null;
  cancelledAt: string | null;
}

type Row = {
  id: string;
  title: string;
  details: string | null;
  startsAt: Date;
  when: string | null;
  location: string | null;
  cadence: string;
  volunteersNeeded: number | null;
  pod: string | null;
  lead: string | null;
  cancelledAt: Date | null;
};

/**
 * Rows that make no sense are dropped rather than rendered.
 *
 * The CHECK constraints make these unreachable through this application, but
 * a row predating them or edited by hand during support would otherwise reach
 * a dashboard as an event with no cadence or a pod nobody is in.
 */
function toEvent(row: Row): ConnectorEvent | null {
  if (!isCadence(row.cadence)) return null;
  if (row.pod !== null && !isPod(row.pod)) return null;

  return {
    id: row.id,
    title: row.title,
    details: row.details,
    startsAt: row.startsAt.toISOString(),
    when: row.when,
    location: row.location,
    cadence: row.cadence,
    volunteersNeeded: row.volunteersNeeded,
    pod: row.pod,
    lead: row.lead,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}

const COLUMNS = {
  id: connectorEvents.id,
  title: connectorEvents.title,
  details: connectorEvents.details,
  startsAt: connectorEvents.startsAt,
  when: connectorEvents.when,
  location: connectorEvents.location,
  cadence: connectorEvents.cadence,
  volunteersNeeded: connectorEvents.volunteersNeeded,
  pod: connectorEvents.pod,
  lead: connectorEvents.lead,
  cancelledAt: connectorEvents.cancelledAt,
};

/**
 * What is coming up for one member, soonest first.
 *
 * Takes the member's pod and returns both their pod's gatherings and the
 * programme-wide ones, because an event with no pod is for everybody and
 * filtering it out would hide the all-hands from the people meant to attend.
 *
 * Cancelled events are included on purpose. Somebody who was planning to come
 * needs to be told it is off, and dropping the row tells them nothing — they
 * just find an empty park. The UI marks them; it does not hide them.
 */
export async function listUpcomingForPod(
  pod: PodId,
  limit = 6
): Promise<ConnectorEvent[]> {
  const rows = await db
    .select(COLUMNS)
    .from(connectorEvents)
    .where(
      and(
        gte(connectorEvents.startsAt, new Date()),
        or(isNull(connectorEvents.pod), eq(connectorEvents.pod, pod))
      )
    )
    .orderBy(asc(connectorEvents.startsAt))
    .limit(limit);

  return rows.flatMap((row) => {
    const event = toEvent(row);
    return event ? [event] : [];
  });
}

/**
 * The console's view: what is coming, and what has quietly lapsed.
 *
 * `staleRecurring` is the useful half. A one-time event in the past is simply
 * over and needs nobody's attention; a *recurring* one in the past means the
 * programme still thinks it runs weekly and the date on it is wrong, which is
 * the only state here that is actively misleading members. Those are the rows
 * somebody has to act on, so they are separated rather than mixed into a
 * single list where they would sit below the fold.
 *
 * Cancelled recurring events are excluded from that — they lapsed on purpose.
 */
export async function listEventsForAdmin(): Promise<{
  upcoming: ConnectorEvent[];
  staleRecurring: ConnectorEvent[];
}> {
  const now = new Date();

  const [upcomingRows, staleRows] = await Promise.all([
    db
      .select(COLUMNS)
      .from(connectorEvents)
      .where(gte(connectorEvents.startsAt, now))
      .orderBy(asc(connectorEvents.startsAt))
      .limit(24),
    db
      .select(COLUMNS)
      .from(connectorEvents)
      .where(
        and(
          lt(connectorEvents.startsAt, now),
          sql`${connectorEvents.cadence} <> 'once'`,
          isNull(connectorEvents.cancelledAt)
        )
      )
      .orderBy(desc(connectorEvents.startsAt))
      .limit(12),
  ]);

  const parse = (rows: Row[]) =>
    rows.flatMap((row) => {
      const event = toEvent(row);
      return event ? [event] : [];
    });

  return {
    upcoming: parse(upcomingRows),
    staleRecurring: parse(staleRows),
  };
}

export async function countUpcomingEvents(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(connectorEvents)
    .where(
      and(
        gte(connectorEvents.startsAt, new Date()),
        isNull(connectorEvents.cancelledAt)
      )
    );

  return row?.count ?? 0;
}

export interface NewConnectorEvent {
  title: string;
  details: string | null;
  startsAt: Date;
  when: string | null;
  location: string | null;
  cadence: Cadence;
  volunteersNeeded: number | null;
  pod: PodId | null;
  lead: string | null;
  createdBy: string | null;
}

export async function createEvent(
  input: NewConnectorEvent
): Promise<ConnectorEvent> {
  const id = createId();

  await db.insert(connectorEvents).values({ id, ...input });

  return {
    id,
    title: input.title,
    details: input.details,
    startsAt: input.startsAt.toISOString(),
    when: input.when,
    location: input.location,
    cadence: input.cadence,
    volunteersNeeded: input.volunteersNeeded,
    pod: input.pod,
    lead: input.lead,
    cancelledAt: null,
  };
}

/**
 * Move an event's next occurrence.
 *
 * The one edit the console needs most, and separate from a general update
 * because it is the answer to `staleRecurring`: the thing staff do over and
 * over is say "the next one is next Thursday", and making that a single field
 * means they do it rather than putting it off.
 */
export async function rescheduleEvent(
  id: string,
  startsAt: Date
): Promise<boolean> {
  const updated = await db
    .update(connectorEvents)
    .set({ startsAt, updatedAt: new Date() })
    .where(eq(connectorEvents.id, id))
    .returning({ id: connectorEvents.id });

  return updated.length > 0;
}

/**
 * Call it off, or put it back on.
 *
 * Soft, so the row stays where people looking for it will find it. Reversible
 * because "cancelled" is occasionally somebody clicking the wrong row, and the
 * alternative to an undo is retyping an event from memory.
 */
export async function setEventCancelled(
  id: string,
  cancelled: boolean
): Promise<boolean> {
  const updated = await db
    .update(connectorEvents)
    .set({ cancelledAt: cancelled ? new Date() : null, updatedAt: new Date() })
    .where(eq(connectorEvents.id, id))
    .returning({ id: connectorEvents.id });

  return updated.length > 0;
}

/**
 * Remove an event outright.
 *
 * For the one typed in error, not for one that is over — cancelling is the
 * answer to "it is not happening", and deleting a gathering people attended
 * erases the only record the programme has that it ever ran.
 */
export async function deleteEvent(id: string): Promise<boolean> {
  const deleted = await db
    .delete(connectorEvents)
    .where(eq(connectorEvents.id, id))
    .returning({ id: connectorEvents.id });

  return deleted.length > 0;
}
