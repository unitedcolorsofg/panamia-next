/**
 * The half of events discovery that both sides run.
 *
 * This module is deliberately free of imports: no database, no schema, no
 * drizzle. `events-discover.tsx` is a client component and it needs
 * `buildLanes`, `buildCategoryRails` and `LANE_COPY` to rebuild the page when
 * the viewer changes the window, so anything it reaches for is bundled into
 * the browser. When these lived next to `getDiscoveryFeed` the bundler
 * followed that file's `@/lib/db` import and shipped a Postgres driver to the
 * browser, where it died on the first reference to `Buffer`.
 *
 * That rule is also why `EVENT_CATEGORIES` is spelled out here rather than
 * imported from `lib/lists` -- see the note on it for why the vocabularies
 * differ in the first place.
 *
 * So the rule this file exists to enforce: types and pure functions here,
 * queries in `discovery.ts`. `discovery.ts` re-exports everything below, which
 * keeps server callers importing from one place.
 *
 * The one import is `./format`, which is pure Intl for the same reason — it is
 * safe to bundle, and the alternative was a second copy of the date rules.
 */
import { dateKey, weekday } from './format';

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

/** A lane is a reason with its evidence, not a category. Subjects live in
 *  `CategoryRail` further down and are a separate type on purpose: a rail has
 *  no `Reason` on it because it is not claiming one. */
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
   Categories. The second axis, and the one that works for a stranger.

   Every reason above is a join against the viewer, which means the page has
   no answer at all for somebody it does not know yet, or for a catalogue too
   young to have a follow graph in it. `buildLanes` degrades honestly in that
   case -- it returns nothing and the page says so -- but "here is all of it,
   ungrouped" is a worse read than it needs to be once there are more than a
   dozen events on.

   So subjects. A rail headed "Music" makes no claim about the reader, which
   is exactly why it is allowed to exist next to lanes that do: the rule this
   file holds is that a heading must not promise a relationship the rows
   cannot evidence, and "these are the music events" is evidenced by the tags
   on them. The failure mode being avoided is the opposite one -- a rail
   headed "Because you like music" over the same cards, which would be a
   ranking wearing a reason's clothes.

   Kept separate from `buildLanes` rather than folded into it, because the two
   answer different questions and the host preview at /e/new consumes the
   reason half on its own.
   ---------------------------------------------------------------------- */

/**
 * A browsable subject, and the tags that put an event in it.
 *
 * Deliberately *not* `profileCategoryList` from lib/lists. That vocabulary
 * describes what a listing **is** -- Products, Services, Apparel -- and those
 * are not things anybody browses events by. An event is what is **happening**,
 * so the set below keeps the directory's words where they genuinely overlap
 * (Music, Food, Art, Wellness, Tech) and adds the ones only events need
 * (Workshops, Market, Community). Seeding maps a host's listing category onto
 * these, which is what keeps the two vocabularies speaking to each other.
 *
 * `match` is matched against normalised tags, so an event tagged `Live Music`
 * or `live-music` lands in the same place as `livemusic`.
 */
export interface EventCategory {
  id: string;
  title: string;
  note: string;
  match: string[];
}

export const EVENT_CATEGORIES: EventCategory[] = [
  {
    id: 'music',
    title: 'Music',
    note: 'Shows, sets and sessions.',
    match: [
      'music',
      'livemusic',
      'dj',
      'concert',
      'gig',
      'band',
      'bands',
      'live',
      'vinyl',
      'salsa',
      'jazz',
      'hiphop',
      'rap',
      'punk',
      'rock',
      'openmic',
      'karaoke',
      'soundsystem',
      'rumba',
      'bachata',
      'reggaeton',
      'dance',
      'party',
    ],
  },
  {
    id: 'art',
    title: 'Art',
    note: 'Making, showing and looking at things.',
    match: [
      'art',
      'arts',
      'gallery',
      'exhibition',
      'mural',
      'zine',
      'zines',
      'print',
      'printmaking',
      'riso',
      'risograph',
      'ceramics',
      'clay',
      'drawing',
      'painting',
      'photography',
      'photo',
      'craft',
      'crafts',
      'diy',
      'sculpture',
      'collage',
      'film',
      'poetry',
    ],
  },
  {
    id: 'food',
    title: 'Food',
    note: 'Cooking, eating and feeding people.',
    match: [
      'food',
      'dinner',
      'supper',
      'brunch',
      'tasting',
      'cafecito',
      'coffee',
      'bake',
      'baking',
      'cooking',
      'potluck',
      'vegan',
      'bbq',
      'cocktails',
      'pastry',
      'kitchen',
      'recipe',
    ],
  },
  {
    id: 'workshops',
    title: 'Workshops',
    note: 'Somebody teaching something they know.',
    match: [
      'workshop',
      'workshops',
      'class',
      'classes',
      'taller',
      'talk',
      'talks',
      'panel',
      'skillshare',
      '101',
      'learn',
      'lesson',
      'seminar',
      'demo',
      'clinic',
      'training',
      'reading',
    ],
  },
  {
    id: 'market',
    title: 'Markets & pop-ups',
    note: 'Things for sale, made by the people selling them.',
    match: [
      'market',
      'markets',
      'popup',
      'popups',
      'vendor',
      'vendors',
      'flea',
      'bazaar',
      'fair',
      'craftfair',
      'swap',
      'thrift',
      'makers',
      'shop',
    ],
  },
  {
    id: 'wellness',
    title: 'Wellness',
    note: 'Moving, resting and looking after yourself.',
    match: [
      'wellness',
      'yoga',
      'meditation',
      'meditate',
      'breathwork',
      'soundbath',
      'movement',
      'run',
      'running',
      'walk',
      'hike',
      'pilates',
      'healing',
      'health',
      'care',
    ],
  },
  {
    id: 'community',
    title: 'Community',
    note: 'Organising, helping and turning up for each other.',
    match: [
      'community',
      'mutualaid',
      'volunteer',
      'cleanup',
      'organizing',
      'organising',
      'meetup',
      'social',
      'dominoes',
      'garden',
      'gardening',
      'neighbors',
      'neighbours',
      'fundraiser',
      'benefit',
      'family',
      'kids',
    ],
  },
  {
    id: 'tech',
    title: 'Tech',
    note: 'Building, fixing and taking things apart.',
    match: [
      'tech',
      'code',
      'coding',
      'hack',
      'hackathon',
      'repair',
      'electronics',
      'ai',
      'software',
      'maker',
      'robotics',
      'game',
      'games',
    ],
  },
];

/** Lowercased and stripped of everything that is not a letter or digit, so
 *  `Live Music`, `live-music` and `livemusic` are one tag rather than three.
 *  Hosts type tags by hand and will never agree on punctuation. */
function normaliseTag(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Which subjects an event belongs to, strongest first.
 *
 * Capped at two. An event tagged broadly enough to land in five rails would
 * appear five times and make every rail read as the same shelf -- the same
 * failure the one-lane-per-event rule above exists to prevent, arriving by a
 * different route. Two lets a printmaking workshop be both Art and Workshops,
 * which is true and useful, without letting anything be everywhere.
 *
 * Takes `{ tags }` rather than a whole `DiscoveryEvent` because tags are all
 * it reads, and asking for more would imply a subject depends on something
 * about an event other than what it is tagged.
 */
export function categoriesFor(event: { tags: string[] }): EventCategory[] {
  const tags = event.tags.map(normaliseTag).filter(Boolean);
  if (tags.length === 0) return [];

  return EVENT_CATEGORIES.map((category) => ({
    category,
    hits: tags.filter((tag) => category.match.includes(tag)).length,
  }))
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2)
    .map((entry) => entry.category);
}

/** A subject with the events in it. Shaped like `Lane` so the page can render
 *  both through one component, but carrying no `Reason` -- that absence is the
 *  type-level statement that a rail is not making a claim about the viewer. */
export interface CategoryRail {
  id: string;
  title: string;
  note: string;
  events: DiscoveryEvent[];
}

/** Rails below this hold too little to be worth a heading, same floor and
 *  same argument as the lanes above. Exported so seeding can check its work
 *  against the real number rather than a copy of it that can drift. */
export const RAIL_FLOOR = 2;

/** How many subjects the page offers at once. Past this it stops being a
 *  shortlist and becomes the whole tag vocabulary with headings on it. */
const MAX_RAILS = 6;

/** How far a single rail scrolls. Generous because scrolling sideways is
 *  cheap, unlike the vertical space another rail costs. */
const MAX_PER_RAIL = 12;

/**
 * Group events by subject, busiest subject first.
 *
 * Draws from the **whole** pool rather than from what the reason lanes left
 * over, which is the one place this deliberately differs from `buildLanes`.
 * The reason there is that a rail is a complete answer to "what music is on",
 * and a Music rail that quietly omitted the one music event already shown
 * under "From hosts you follow" would be wrong rather than merely shorter.
 *
 * Repetition across the two sections is therefore expected and is why the page
 * separates them under their own heading: the same catalogue, read two ways.
 * Repetition *within* the reason lanes would still be a bug.
 *
 * Ordered by how much is actually on, so the page leads with the subject the
 * week is really about, and ties break on the table's own order so the result
 * is stable when two subjects are level.
 */
export function buildCategoryRails(
  candidates: DiscoveryEvent[]
): CategoryRail[] {
  const buckets = new Map<string, DiscoveryEvent[]>();

  for (const event of candidates) {
    for (const category of categoriesFor(event)) {
      const bucket = buckets.get(category.id);
      if (bucket) bucket.push(event);
      else buckets.set(category.id, [event]);
    }
  }

  return EVENT_CATEGORIES.map((category) => ({
    category,
    events: buckets.get(category.id) ?? [],
  }))
    .filter((entry) => entry.events.length >= RAIL_FLOOR)
    .sort((a, b) => b.events.length - a.events.length)
    .slice(0, MAX_RAILS)
    .map(({ category, events }) => ({
      id: category.id,
      title: category.title,
      note: category.note,
      events: events.slice(0, MAX_PER_RAIL),
    }));
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
 * Date and time formatting lives in ./format.ts.
 *
 * The personal calendar needed the same four helpers. `timezone` is a free
 * text column, and the copies in ./format.ts treat a bad value as missing
 * rather than throwing — which is what discovery wants too, since one wrong
 * clock face beats a RangeError taking the page down. Re-exported so existing
 * callers that import them from here keep working.
 */
export { dateKey, weekday, formatWhen, formatDay } from './format';

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
 *  Miami is at 8pm on the page wherever it is read from. Defined in
 *  ./format.ts and re-exported above. */
