/**
 * Attaching a commitment to an event.
 *
 * Pure — no database import — because the assign form is a client component
 * and the encoding below has to be the same on both sides of the request.
 *
 * ## Why a commitment points at one of two tables
 *
 * Panamia runs two kinds of gathering and they are not the same object:
 *
 * - A **public event** (`events`) has a slug, a URL, an iCal UID, a venue and
 *   RSVPs. People attend it. It is the thing on the public calendar.
 * - A **programme event** (`connector_events`) is internal logistics: a weekly
 *   pod huddle, a training. It recurs, it is scoped to a pod, its location is
 *   free text, and it has no public face at all.
 *
 * Connectors get assigned to both. A commitment therefore names at most one of
 * them, and `drizzle/0061` enforces "at most one" with a CHECK.
 *
 * ## Why the select value is `kind:id` and not just `id`
 *
 * Both tables key on cuid2, so an id alone cannot say which table it came
 * from — and guessing by probing both is a lookup that can match twice. One
 * dropdown spans two tables, so the kind has to travel with the id. The
 * encoding is deliberately boring and parsed defensively: a malformed value is
 * `null`, never a half-built reference.
 *
 * The separator is a colon because cuid2 is alphanumeric and so can never
 * contain one. `split` is capped at the first colon anyway, so an id that
 * somehow did contain one would still round-trip.
 */

export type EventKind = 'public' | 'programme';

export interface AssignableEvent {
  kind: EventKind;
  id: string;
  title: string;
  /** ISO 8601. Used for ordering and for the date shown beside the title. */
  startsAt: string;
  /**
   * Where it is, as a human would say it. The venue name for a public event,
   * the free-text location for a programme one, `null` when online or unsaid.
   */
  where: string | null;
  /**
   * How many bodies the event asked for. Programme events only — a public
   * event's `attendee_cap` counts guests, not crew, and conflating the two
   * would report a sold-out party as a fully-staffed one.
   */
  volunteersNeeded: number | null;
}

/** What one connector's assignment to an event costs, in the aggregate. */
export interface EventStaffing {
  /** Distinct commitments pointing here. One person may hold more than one. */
  connectors: number;
  estimatedMinutes: number;
  /** Commitments here that nobody has sized. */
  unestimated: number;
}

export const EMPTY_STAFFING: EventStaffing = {
  connectors: 0,
  estimatedMinutes: 0,
  unestimated: 0,
};

/** The `<option value>` for an event. See the module docblock. */
export function eventValue(event: {
  kind: EventKind;
  id: string;
}): string {
  return `${event.kind}:${event.id}`;
}

/**
 * Read back what `eventValue` wrote.
 *
 * Returns `null` for anything that is not exactly one known kind and a
 * non-empty id, including the empty string the "no event" option carries.
 * Callers distinguish "chose nothing" from "sent nonsense" before calling,
 * because only one of those is an error.
 */
export function parseEventValue(
  value: string
): { kind: EventKind; id: string } | null {
  const separator = value.indexOf(':');
  if (separator <= 0) return null;

  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);

  if (kind !== 'public' && kind !== 'programme') return null;
  if (!id) return null;

  return { kind, id };
}

/**
 * Split an assignment into the two nullable columns the table stores.
 *
 * The CHECK in 0061 refuses a row with both set, so the one place that builds
 * the pair is the one place that can get it wrong — and it cannot, because it
 * always writes a null alongside whichever it sets.
 */
export function eventColumns(
  parsed: { kind: EventKind; id: string } | null
): { eventId: string | null; connectorEventId: string | null } {
  if (!parsed) return { eventId: null, connectorEventId: null };

  return parsed.kind === 'public'
    ? { eventId: parsed.id, connectorEventId: null }
    : { eventId: null, connectorEventId: parsed.id };
}

/**
 * How staffed an event is, as a sentence.
 *
 * Mirrors `describeLoad`: the unsized count is reported rather than folded
 * into the hours, because "3 on it · 6h" and "3 on it · 6h · 1 not sized"
 * describe different levels of confidence in the same number.
 *
 * `volunteersNeeded` becomes a denominator only when the event set one. Most
 * do not, and inventing a target would turn "we have three people" into "we
 * are short", which is a different claim.
 */
export function describeStaffing(
  staffing: EventStaffing,
  volunteersNeeded: number | null,
  formatMinutes: (minutes: number) => string
): string {
  if (staffing.connectors === 0) {
    return volunteersNeeded ? `nobody yet of ${volunteersNeeded}` : 'nobody yet';
  }

  const head = volunteersNeeded
    ? `${staffing.connectors} of ${volunteersNeeded}`
    : `${staffing.connectors} assigned`;

  const parts = [head];
  if (staffing.estimatedMinutes > 0) {
    parts.push(formatMinutes(staffing.estimatedMinutes));
  }
  if (staffing.unestimated > 0) {
    parts.push(`${staffing.unestimated} not sized`);
  }

  return parts.join(' · ');
}

/**
 * Is this event short of the crew it asked for?
 *
 * `false` when it never asked. An event with no `volunteersNeeded` is not
 * understaffed, it is unquantified, and painting it as short would put every
 * casual gathering on the same list as the one genuinely missing people.
 */
export function isUnderstaffed(
  staffing: EventStaffing,
  volunteersNeeded: number | null
): boolean {
  if (!volunteersNeeded) return false;
  return staffing.connectors < volunteersNeeded;
}
