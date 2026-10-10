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

/** The viewer-dependent half of a reason. Separated so `reasonsFor` stays a
 *  pure function of resolved facts, testable without a database. */
export interface ViewerFacts {
  pastEvents: number;
  followsHost: boolean;
  panas: DiscoveryPana[];
  attended: { title: string; tags: string[] }[];
}

/**
 * Every reason that holds for an event, strongest first.
 *
 * Order is the editorial judgement of the page and worth stating plainly:
 * a host you chose to follow beats people you know going, which beats a
 * subject you have turned up for before, which beats the page arguing on an
 * unknown host's behalf. Each event is then placed in exactly one lane, by its
 * strongest reason -- the same event appearing under three headings is the
 * fastest way to make a page of four lanes feel like a page of one.
 *
 * Here rather than next to `getDiscoveryFeed` because it is the one piece both
 * sides of the product need. `/e` runs it over real rows to rank a reader's
 * page; `/e/new` runs it in the browser over a draft, so a host can see which
 * lanes the thing they are typing would reach. Two copies of these thresholds
 * would drift within a release, and the host page would start promising lanes
 * the discovery page does not actually grant.
 */
export function reasonsFor(
  event: DiscoveryEvent,
  facts: ViewerFacts
): Reason[] {
  const out: Reason[] = [];

  if (facts.followsHost)
    out.push({ kind: 'follow-host', host: event.host.name });

  /* Three rather than one: two panas going is a coincidence, and a lane that
     fires on a single RSVP turns every event one friend attends into a
     personalised recommendation. */
  if (facts.panas.length >= 3) {
    out.push({ kind: 'panas-going', panas: facts.panas });
  }

  const match = tagMatch(event, facts.attended);
  if (match) out.push({ kind: 'tag-match', ...match });

  if (facts.pastEvents <= 1 && event.going < 50) {
    out.push({
      kind: 'new-host',
      host: event.host.name,
      pastEvents: facts.pastEvents,
    });
  }

  return out;
}

/** Tags this event shares with something the viewer actually turned up to,
 *  plus which past event earned the match. Returns null when there is no
 *  overlap, so the caller cannot accidentally render an empty claim. */
function tagMatch(
  event: DiscoveryEvent,
  attended: { title: string; tags: string[] }[]
): { tags: string[]; from: string } | null {
  for (const past of attended) {
    const shared = event.tags.filter((tag) => past.tags.includes(tag));
    if (shared.length > 0) return { tags: shared, from: past.title };
  }
  return null;
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

/* ----------------------------------------------------------------------
   Time. Pure, Intl-only, and down here rather than beside the queries so the
   host form at /e/new can render a draft exactly the way /e renders a row.
   A second copy of formatWhen would drift, and the first thing a host would
   notice is that the card they were promised is not the card they got.
   ---------------------------------------------------------------------- */

/**
 * The timezone the windows are reckoned in.
 *
 * "Tonight" is a claim about the viewer, not about the event, so it needs one
 * answer rather than one per row. South Florida is what this directory is, and
 * it is already the default on `events.timezone`; a viewer reading from
 * elsewhere is looking at what is on *here*, which is the only reading of
 * "tonight" that makes sense on a page about places you can physically go.
 */
export const SITE_TIMEZONE = 'America/New_York';

/**
 * The calendar date in a given timezone, as YYYY-MM-DD.
 *
 * `en-CA` rather than arithmetic on a Date: it is the one common locale whose
 * short date format is already ISO order, so this is a formatter call rather
 * than three getters and a pad, and it gets DST right because Intl does.
 */
export function dateKey(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** 0 = Sunday, in the given timezone. */
export function weekday(at: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(at);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/**
 * Which window an event falls in.
 *
 * The buckets are the viewer's situation, not even divisions of the calendar,
 * so they overlap in the way the words do and are resolved in order: an event
 * tonight is "tonight" even though it is also this week. `weekend` runs Friday
 * through Sunday and only means *this coming* one -- on a Monday the weekend
 * is five days away and still the weekend, but on the following Tuesday it is
 * gone rather than eleven days off.
 */
export function bucketFor(startsAt: Date, now: Date): WhenBucket {
  const today = dateKey(now, SITE_TIMEZONE);
  const day = dateKey(startsAt, SITE_TIMEZONE);
  if (day === today) return 'today';

  const daysOut = Math.round(
    (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000
  );

  /* Days until the coming Sunday. Sunday itself counts as 0, so an event on a
     Sunday is still this weekend rather than next. */
  const todayDow = weekday(now, SITE_TIMEZONE);
  const untilSunday = (7 - todayDow) % 7;
  const eventDow = weekday(startsAt, SITE_TIMEZONE);
  if (daysOut <= untilSunday && eventDow >= 5) return 'weekend';

  if (daysOut <= 31) return 'month';
  return 'later';
}

/** "Fri 20 Feb, 7:00 PM", in the event's own timezone -- a show at 8pm in
 *  Miami is at 8pm on the page wherever it is read from. */
export function formatWhen(at: Date, timeZone: string): string {
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(at);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(at);
  return `${date}, ${time}`;
}

/** "Fri 20" — the calendar tab's day heading. */
export function formatDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
  }).format(at);
}
