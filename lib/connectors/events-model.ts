import { PODS } from '@/lib/connectors/model';
import type { PodId } from '@/lib/connectors/model';

/**
 * A programme gathering as a shape, with no way to read or write one.
 *
 * This file exists because of a crash. `lib/connectors/events.ts` opens with
 * `import { db } from '@/lib/db'`, so anything that imports a *value* from it
 * pulls Postgres in behind that value. The admin console is a client
 * component and wanted two of them — the cadence list and its labels, to
 * build a `<select>` — which was enough to bundle the driver into the
 * browser. The driver reaches for `Buffer` while it is being evaluated, and
 * `Buffer` is a Node global, so the chunk threw `Buffer is not defined`
 * before a single element rendered and the whole page fell back to the error
 * screen.
 *
 * The form needed vocabulary, not a database. So the vocabulary lives here,
 * importing nothing that cannot run in a browser, and both halves import it:
 * `events.ts` for its queries, client components for their forms.
 *
 * The rule this encodes: anything a form needs in order to render belongs on
 * the client side of the line. Keep it that way and the next person adding a
 * field will not reintroduce the crash.
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

/** One `connector_events` row, as the driver hands it back. */
export type EventRow = {
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
export function toEvent(row: EventRow): ConnectorEvent | null {
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
