/**
 * The half of events discovery that both sides run.
 *
 * This module is deliberately free of imports: no database, no schema, no
 * drizzle. `events-discover.tsx` is a client component and it needs
 * `buildLanes` and `LANE_COPY` to rebuild the page when the viewer changes the
 * window, so anything it reaches for is bundled into the browser. When these
 * lived next to `getDiscoveryFeed` the bundler followed that file's `@/lib/db`
 * import and shipped a Postgres driver to the browser, where it died on the
 * first reference to `Buffer`.
 *
 * So the rule this file exists to enforce: types and pure functions here,
 * queries in `discovery.ts`. `discovery.ts` re-exports everything below, which
 * keeps server callers importing from one place.
 */

/**
 * A pana, as the "your panas are going" line needs them.
 *
 * Named and faced rather than counted: the whole value of a social signal is
 * that you recognise the people in it, and "Bee, Claribel and Gabriel are
 * going" is checkable in a way that "3 panas are going" never is.
 */
export interface DiscoveryPana {
  id: string;
  name: string;
  screenname: string | null;
  avatar: string | null;
}

/**
 * Why one event is being shown, with the evidence attached.
 *
 * Each variant carries the material the card needs to state its case in
 * specifics -- the host's name, the actual panas, the actual overlapping tags.
 * A reason that renders as "recommended for you" is not a reason, and the
 * shape of this union is what makes that impossible to write.
 */
export type Reason =
  | { kind: 'follow-host'; host: string }
  | { kind: 'panas-going'; panas: DiscoveryPana[] }
  | { kind: 'tag-match'; tags: string[]; from: string }
  | { kind: 'new-host'; host: string; pastEvents: number }
  | { kind: 'popular'; going: number };

export type ReasonKind = Reason['kind'];

/**
 * The windows the one control offers.
 *
 * Bucketed on the server, in SITE_TIMEZONE, and shipped on the row. Computing
 * it in the browser instead would be a hydration bug waiting to happen: the
 * server renders in UTC and the viewer's machine does not, so "tonight" would
 * mean two different sets and React would reconcile the difference silently.
 */
export type WhenBucket = 'today' | 'weekend' | 'month' | 'later';

/**
 * One event, flattened for the client.
 *
 * Dates cross as ISO strings rather than `Date`s. The card renders them in the
 * event's own timezone, which is a property of the event and not of whoever is
 * reading it -- a show at 8pm in Miami is at 8pm on the page no matter where
 * the viewer opens it.
 */
export interface DiscoveryEvent {
  id: string;
  slug: string;
  title: string;
  blurb: string;
  cover: string | null;
  coverAlt: string | null;
  mode: 'offline' | 'online' | 'hybrid';
  /** ISO 8601, UTC. Kept alongside the formatted strings for sorting and keys. */
  startsAt: string;
  /** Already formatted in the event's own timezone — "Fri 20 Feb, 7:00 PM". */
  when: string;
  /** Short day label for calendar grouping — "Fri 20". */
  day: string;
  /** Which window this answers to. */
  bucket: WhenBucket;
  timezone: string;
  where: string;
  going: number;
  cap: number | null;
  tags: string[];
  host: { id: string; name: string; isGroup: boolean };
  /** Every reason that holds, strongest first. Empty is a valid answer. */
  reasons: Reason[];
}

/** A lane is a reason with its evidence, not a category. */
export interface Lane {
  id: string;
  /** The heading. Written as the reason itself, in the viewer's terms. */
  title: string;
  /** One line under it, saying what the lane is doing and why it exists. */
  note: string;
  events: { event: DiscoveryEvent; reason: Reason }[];
}

export const LANE_COPY: Record<
  ReasonKind,
  { id: string; title: string; note: string }
> = {
  'follow-host': {
    id: 'following',
    title: 'From hosts you follow',
    note: 'You chose these people. Nothing is being guessed here.',
  },
  'panas-going': {
    id: 'panas',
    title: 'Your panas are going',
    note: 'Counted from RSVPs by people you follow — not from who is popular.',
  },
  'tag-match': {
    id: 'tags',
    title: 'Like things you have turned up to',
    note: 'Matched on the tags of events you actually attended, not browsed.',
  },
  'new-host': {
    id: 'new',
    title: 'New hosts, small rooms',
    note: 'First or second time hosting. Ranking by attendance would bury every one of these.',
  },
  popular: {
    id: 'popular',
    title: 'You would have found these anyway',
    note: 'The biggest things on. Last rather than first, because they do not need the help.',
  },
};

/** How full an event is, or null when it is uncapped. Rendered as urgency on
 *  the card rather than as a lane: "three seats left" is a reason to hurry,
 *  never a reason the event suits you, and the two must not be dressed alike. */
export function seatsLeft(event: DiscoveryEvent): number | null {
  if (event.cap === null) return null;
  return Math.max(0, event.cap - event.going);
}

/**
 * Bucket a set of events into lanes.
 *
 * Pure, and deliberately so: the page re-runs it in the browser every time the
 * viewer changes the window, over reasons the server already resolved.
 *
 * Signed out, `follow-host`, `panas-going` and `tag-match` are not zero -- they
 * are unknowable, because every one of them is a join against the viewer. So
 * the signed-out page is not this page with empty sections; it is the subset
 * that can be computed for a stranger. That is the honest difference and the
 * caller renders a sign-in prompt alongside it rather than a sad empty state.
 *
 * Lanes under two events are dropped. A heading over a single card claims a
 * pattern that one row cannot evidence, and four such lanes is a page that
 * looks personalised while saying nothing.
 */
export function buildLanes(
  candidates: DiscoveryEvent[],
  { signedIn }: { signedIn: boolean }
): { lanes: Lane[]; leftovers: DiscoveryEvent[] } {
  const order: ReasonKind[] = signedIn
    ? ['follow-host', 'panas-going', 'tag-match', 'new-host']
    : ['new-host'];

  const claimed = new Set<string>();
  const lanes: Lane[] = [];

  for (const kind of order) {
    /* Only events no earlier lane took, so the same card never appears twice.
       Re-offering the remainder at each step also means an event cut from a
       full lane cascades to its next-best reason rather than disappearing:
       the screenprint workshop that lost the three-slot "panas going" cut is
       still a tag match, and lands there. */
    const pool = candidates
      .filter((event) => !claimed.has(event.id))
      .map((event) => ({
        event,
        reason: event.reasons.find((r) => r.kind === kind),
      }))
      .filter(
        (entry): entry is { event: DiscoveryEvent; reason: Reason } =>
          entry.reason !== undefined
      );

    const picked = pool.sort((a, b) => laneRank(b) - laneRank(a)).slice(0, 3);

    /* Claimed only once the lane is certain to render, and only the cards that
       survived the cut. Claiming earlier silently drops every event a lane
       gathered and then did not show -- which is the worst failure available
       to a page whose entire promise is that it will surface things. */
    if (picked.length < 2) continue;

    for (const entry of picked) claimed.add(entry.event.id);
    const copy = LANE_COPY[kind];
    lanes.push({
      id: copy.id,
      title: copy.title,
      note: copy.note,
      events: picked,
    });
  }

  /* Whatever no lane spoke for, biggest first. These are the events a plain
     popularity sort would have led with, which is exactly why they are last. */
  const leftovers = candidates
    .filter((event) => !claimed.has(event.id))
    .sort((a, b) => b.going - a.going);

  return { lanes, leftovers };
}

/** Within a lane, lead with the strongest instance of that lane's own reason:
 *  the most panas, the most overlapping tags, the newest host. Sorting every
 *  lane by date instead would make four lanes read as four copies of the
 *  calendar. */
function laneRank({
  reason,
  event,
}: {
  reason: Reason;
  event: DiscoveryEvent;
}): number {
  switch (reason.kind) {
    case 'panas-going':
      return reason.panas.length;
    case 'tag-match':
      return reason.tags.length;
    case 'new-host':
      return 10 - reason.pastEvents;
    default:
      return -event.going;
  }
}
