import type { SuggestionKind } from '@/lib/suggest';

/**
 * Fixtures for /mock/explore.
 *
 * The proposal, in one paragraph: the scope toggle stops being a directory
 * control and becomes part of the front door's search box, the directory
 * narrows to businesses only, and events, groups and panas each get a page
 * built around the question that kind is actually asked.
 *
 * Everything below exists to make that argument checkable rather than
 * assertable, so the fixtures are written against the awkward cases — an
 * online group with no county, an event with no cover, a pana who publishes
 * no neighbourhood, a business claimed last week with nothing in it yet.
 * Those are the rows a layout designed for the happy case quietly drops, and
 * a mock that only contains complete records cannot show you that it does.
 */

/* -------------------------------------------------------------------------
   Scopes, and where each one now lands
   ------------------------------------------------------------------------- */

/**
 * The scope a search can be pointed at.
 *
 * Aliased to `SuggestionKind` rather than redeclared, so this mock cannot
 * drift from the four kinds the real typeahead returns — if a fifth kind is
 * added upstream, every `Record<ExploreScope, …>` below stops compiling until
 * it is answered for here.
 */
export type ExploreScope = SuggestionKind;

/**
 * The four kinds, with no "Everything".
 *
 * Today's bar leads with Everything and lands a bare search in businesses,
 * which is two defaults disagreeing: the menu says the box searches all four,
 * the submit says it searches one. Dropping Everything settles that in favour
 * of the honest answer — the box searches whatever the chip says — at a cost
 * worth naming rather than hiding.
 *
 * The cost: Everything was the only place a visitor who does not yet know our
 * nouns could type "art" and discover that groups exist at all. The
 * replacement for that discovery is the menu itself. It is on the homepage
 * now rather than three clicks into the directory, it names all four kinds
 * with a sentence each, and it says where each one goes — so the teaching
 * happens on the way in, before the query, instead of in a results page after
 * it.
 *
 * Ordered businesses-first because that is the default and a menu should open
 * on its default, then events, groups, panas: public before members-only, so
 * the locked row is last rather than sitting in the middle of the list.
 */
export const EXPLORE_SCOPES: readonly ExploreScope[] = [
  'business',
  'event',
  'group',
  'pana',
];

/**
 * The scope a visitor who has not chosen one gets.
 *
 * Businesses: the largest set, the only one that is entirely public, and the
 * thing the club is most often asked for by someone arriving cold. It is also
 * what a bare search already does today, so no one's muscle memory breaks on
 * the day this ships.
 */
export const DEFAULT_EXPLORE_SCOPE: ExploreScope = 'business';

export const SCOPE_LABEL: Record<ExploreScope, string> = {
  business: 'Businesses',
  event: 'Events',
  group: 'Groups',
  pana: 'Panas',
};

/**
 * One line of plain description per scope, as the live scope menu carries.
 *
 * Nouns are ambiguous here: "Groups" could be read as businesses with several
 * locations, and "Panas" means nothing at all on a first visit. One line of
 * description is the difference between a menu you read and one you guess at.
 */
export const SCOPE_BLURB: Record<ExploreScope, string> = {
  business: 'Shops, makers, studios and venues',
  event: 'Shows, markets and meetups near you',
  group: 'Find your people, or start a group',
  pana: 'Members by name, craft or handle',
};

/**
 * What the search field says once a scope has been picked.
 *
 * A consequence of the change that is easy to miss and expensive to skip. The
 * homepage placeholder is "Search panas, businesses, groups, events" — it
 * lists the four kinds precisely because the field had no other way to tell
 * you it covered them. Once the scope is a visible control sitting inside the
 * same pill, that list is redundant at best and contradictory at worst: a
 * field reading "Businesses" on the left should not be inviting you to type
 * an event name on the right.
 *
 * So the placeholder narrows with the scope, and in doing so it gets to say
 * something useful about *how* to search each kind — by craft for a business,
 * by night out for an event, by handle for a pana — which the four-noun list
 * never had room for.
 */
export const SCOPE_PLACEHOLDER: Record<ExploreScope, string> = {
  business: 'Search local businesses — coffee, tattoo, ceramics…',
  event: 'Search events — markets, shows, workshops…',
  group: 'Search groups — run club, book club, mutual aid…',
  pana: 'Search panas by name, craft or @handle',
};

/**
 * Where submitting in each scope goes.
 *
 * The one piece of information the live menu does not carry and this one must,
 * because the destinations are no longer variations on a single results page.
 * Picking Events is not narrowing the directory any more — it is leaving it,
 * for a page with a calendar and an RSVP button. A control that changes which
 * product you land in should say so before Enter, not after.
 */
export const SCOPE_DESTINATION: Record<ExploreScope, string> = {
  business: '/directory/search',
  event: '/explore/events',
  group: '/explore/groups',
  pana: '/explore/panas',
};

/**
 * Scopes only offered to signed-in members.
 *
 * Mirrors `SCOPE_REQUIRES_PANA` in lib/directory-scopes.ts. Panas stay
 * members-only; groups become public here, which is a change from today and
 * is argued for on the groups view — a group that cannot be found by someone
 * who is not yet a member cannot recruit one.
 */
export const SCOPE_REQUIRES_PANA: Record<ExploreScope, boolean> = {
  business: false,
  event: false,
  group: false,
  pana: true,
};

/**
 * Tone tokens from the `[data-tone]` set in app/globals.css.
 *
 * Carried over unchanged from lib/directory-scopes.ts so a kind cannot be one
 * colour in the menu and another on the page it opens. The explore pages tint
 * their own eyebrow and primary action from this, which is new: today every
 * scope page is the same indigo, so the only thing telling you which one you
 * are on is the heading.
 */
export const SCOPE_TONE: Record<ExploreScope, string> = {
  business: 'burnt',
  event: 'red',
  group: 'flame',
  pana: 'blue',
};

/* -------------------------------------------------------------------------
   Results
   ------------------------------------------------------------------------- */

const FACES = [
  '/img/about/anette_mago.jpg',
  '/img/about/bee_maria.jpg',
  '/img/about/claribel_avila.jpg',
  '/img/about/gbarrios.jpg',
];

/**
 * A business, as the directory already renders one.
 *
 * Unchanged from what ships, deliberately. The directory is not being
 * redesigned here, it is being narrowed — so the business card appearing in
 * this mock exactly as it appears today is the point. The only thing that
 * leaves that page is the scope chip row.
 */
export interface MockBusiness {
  id: string;
  name: string;
  tagline: string;
  /** Stands in for `profiles.city`. */
  where: string;
  /** Null until the viewer shares a location. */
  distance: string | null;
  blurb: string;
  categories: string[];
  cover: string | null;
  badge: string | null;
  signal: string;
  faces: string[];
  nextEvent: string | null;
  certified: boolean;
  /**
   * Where the pin goes. Null for a business with no address to plot — an
   * online-only shop, a service that travels. The map has to say so out loud
   * rather than quietly dropping them, or the count beside the results stops
   * matching the count on the map.
   */
  coords: { lat: number; lng: number } | null;
}

export const BUSINESSES: MockBusiness[] = [
  {
    id: 'b1',
    name: 'El Fogón Food Truck',
    tagline: 'Arepas and slow-cooked pernil',
    where: 'Coral Springs',
    distance: '2.4 mi',
    blurb:
      'We started out of a home kitchen selling to neighbours, and we still cook the same way — one pot at a time, mostly on weekends.',
    categories: ['Food', 'Products'],
    cover: '/img/impact/hero-mixer.webp',
    badge: '/img/impact/partner-dale.webp',
    signal: '12 recommend',
    faces: FACES.slice(0, 4),
    nextEvent: 'Tonight at Green Market',
    certified: true,
    coords: { lat: 26.271, lng: -80.271 },
  },
  {
    id: 'b2',
    name: 'Barrio Arts Lab',
    tagline: 'A working studio and gallery',
    where: 'Delray Beach',
    distance: '11 mi',
    blurb:
      'Open studio Thursdays. Screenprinting, risograph and a wall that belongs to whoever books it first.',
    categories: ['Services', 'Venues'],
    cover: '/img/impact/culture-zines-left.webp',
    badge: null,
    signal: '6 recommend',
    faces: FACES.slice(0, 2),
    nextEvent: null,
    certified: false,
    coords: { lat: 26.456, lng: -80.073 },
  },
  {
    /* No cover, no logo, no distance, nothing recommended yet — the listing a
       pana claimed last week. If the card only looks finished with ten fields
       filled, it is the wrong card. */
    id: 'b3',
    name: 'Taller Lucía',
    tagline: 'Hand-thrown tableware, made to order',
    where: 'Little Haiti',
    distance: null,
    blurb:
      'A one-woman pottery studio. Commissions open twice a year; everything else is whatever survived the kiln.',
    categories: ['Products', 'Art'],
    cover: null,
    badge: null,
    signal: 'New listing',
    faces: [],
    nextEvent: null,
    certified: false,
    coords: { lat: 25.824, lng: -80.193 },
  },
  {
    /* Online-only, so it matches the search and cannot be pinned. It exists
       to keep the map honest: with a pane on screen permanently, "3 results"
       beside two pins is a discrepancy a visitor will notice, and the map has
       to account for the difference rather than let them assume it is broken. */
    id: 'b4',
    name: 'Sello Press',
    tagline: 'Risograph zines, shipped',
    where: 'Online · ships from Hialeah',
    distance: null,
    blurb:
      'No storefront and no pickup — everything goes out by mail, which is the only reason this one is not on the map.',
    categories: ['Products', 'Art'],
    cover: null,
    badge: null,
    signal: '4 recommend',
    faces: FACES.slice(1, 3),
    nextEvent: null,
    certified: false,
    coords: null,
  },
];

/**
 * An event.
 *
 * These fields are the argument for why events cannot stay a directory scope.
 * A directory row is a thing that persists and is looked up; an event is a
 * thing that happens once and then stops being true. So the row carries a
 * start time and a mode, the list sorts by time rather than by relevance, the
 * page groups by day, and the primary action is RSVP rather than View — none
 * of which the directory's shape has anywhere to put.
 *
 * `isoDate` is separate from the rendered parts because the grouping compares
 * whole days while the rail prints `day` and `month`. A mock that formatted
 * dates at render time would be inventing a timezone, and the real page has to
 * take that from `events.timezone` rather than from the reader's browser.
 */
export interface MockEvent {
  id: string;
  /** Groups the list. Stands in for `events.startsAt` truncated to the day. */
  isoDate: string;
  dayLabel: string;
  /** The date rail's two lines. */
  day: string;
  month: string;
  name: string;
  time: string;
  /** `events.mode` — an online event has no venue and no county. */
  mode: 'in-person' | 'online';
  venue: string | null;
  where: string | null;
  blurb: string;
  tags: string[];
  cover: string | null;
  price: string;
  going: number;
  /** `events.attendeeCap`. Null means uncapped. */
  cap: number | null;
  faces: string[];
  /** The business or pana putting it on. */
  host: string;
}

export const EVENTS: MockEvent[] = [
  {
    id: 'e1',
    isoDate: '2026-02-20',
    dayLabel: 'Friday 20 February',
    day: '20',
    month: 'Feb',
    name: 'Heatwave Visions: Opening Night',
    time: '7:00 – 10:00 PM',
    mode: 'in-person',
    venue: 'Bakehouse Art Complex',
    where: 'Wynwood · Miami-Dade',
    blurb:
      'Twelve South Florida artists on heat, water and the year the summer did not end. Cash bar, no dress code.',
    tags: ['Art', 'Free'],
    cover: '/img/impact/heatwave-visions.webp',
    price: 'Free',
    going: 23,
    cap: 80,
    faces: FACES.slice(0, 3),
    host: 'Bakehouse Art Complex',
  },
  {
    id: 'e2',
    isoDate: '2026-02-20',
    dayLabel: 'Friday 20 February',
    day: '20',
    month: 'Feb',
    name: 'Friday Night Green Market',
    time: '5:00 – 9:00 PM',
    mode: 'in-person',
    venue: 'Sample Road Lot',
    where: 'Coral Springs · Broward',
    blurb:
      'Twenty-odd vendors, most of them panas. El Fogón is in the back corner by the generator.',
    tags: ['Market', 'Food', 'Family'],
    cover: '/img/impact/hero-mixer.webp',
    price: 'Free',
    going: 61,
    cap: null,
    faces: FACES.slice(1, 4),
    host: 'Pana MIA Club',
  },
  {
    /* Online, so no venue and no county — the two fields a location-first
       layout assumes are always present. */
    id: 'e3',
    isoDate: '2026-02-21',
    dayLabel: 'Saturday 21 February',
    day: '21',
    month: 'Feb',
    name: 'Pricing Your Work Without Apologising',
    time: '11:00 AM – 12:30 PM',
    mode: 'online',
    venue: null,
    where: null,
    blurb:
      'A working session on quoting, deposits and the sentence you say when someone asks for a discount.',
    tags: ['Workshop', 'Business'],
    cover: null,
    price: '$10 sliding',
    going: 14,
    cap: 30,
    faces: FACES.slice(2, 4),
    host: 'Claribel Ávila',
  },
  {
    id: 'e4',
    isoDate: '2026-02-21',
    dayLabel: 'Saturday 21 February',
    day: '21',
    month: 'Feb',
    name: 'Zine Swap + Risograph Open House',
    time: '2:00 – 6:00 PM',
    mode: 'in-person',
    venue: 'Barrio Arts Lab',
    where: 'Delray Beach · Palm Beach',
    blurb:
      'Bring five copies of anything you made. We trade, we read, nobody critiques unless you ask.',
    tags: ['Zines', 'Print', 'Free'],
    cover: '/img/impact/culture-zines-right.webp',
    price: 'Free',
    going: 38,
    cap: 40,
    faces: FACES.slice(0, 4),
    host: 'South Florida Zine Club',
  },
  {
    /* Sold out. The state an RSVP button has to have an answer for, and the
       reason `cap` is on the row at all. */
    id: 'e5',
    isoDate: '2026-02-26',
    dayLabel: 'Thursday 26 February',
    day: '26',
    month: 'Feb',
    name: 'Long Table Dinner: Six Cooks, One Menu',
    time: '7:30 PM',
    mode: 'in-person',
    venue: 'The Citadel rooftop',
    where: 'Little River · Miami-Dade',
    blurb:
      'Six pana kitchens each take a course. Seats are limited and go to the waitlist first.',
    tags: ['Food', 'Ticketed'],
    cover: '/img/impact/culture-zines-left.webp',
    price: '$45',
    going: 40,
    cap: 40,
    faces: FACES.slice(0, 3),
    host: 'El Fogón Food Truck',
  },
];

/**
 * A group.
 *
 * Groups split from events on one fact: a group is ongoing and an event is
 * not, so "when is it" has a different kind of answer — a rhythm ("second
 * Saturday, monthly") rather than a timestamp. The card leads with the rhythm
 * and the member count, because those two together are what tell someone
 * whether this is a thing they could actually turn up to.
 *
 * `joinPolicy` is the other reason this is not a directory row. A directory
 * listing is looked at; a group is joined, requested, or closed to you, and
 * the button has to say which of those before it is pressed.
 */
export interface MockGroup {
  id: string;
  name: string;
  purpose: string;
  blurb: string;
  /** Null for an online group — the field a county filter must tolerate. */
  where: string | null;
  mode: 'in-person' | 'online' | 'hybrid';
  rhythm: string | null;
  members: number;
  tags: string[];
  cover: string | null;
  faces: string[];
  joinPolicy: 'open' | 'request' | 'invite';
  /** True for the member's own groups shelf. */
  joined: boolean;
  /** Recent activity — what separates a live group from an abandoned one. */
  activity: string;
}

export const GROUPS: MockGroup[] = [
  {
    id: 'g1',
    name: 'South Florida Zine Club',
    purpose: 'Monthly swaps and a shared risograph',
    blurb:
      'Bring five copies of anything you made. We trade, we read, nobody critiques unless you ask.',
    where: 'Meets across Broward',
    mode: 'in-person',
    rhythm: 'Second Saturday, monthly',
    members: 88,
    tags: ['Zines', 'Print', 'Open to all'],
    cover: '/img/impact/culture-zines-right.webp',
    faces: FACES.slice(0, 3),
    joinPolicy: 'open',
    joined: true,
    activity: '12 posts this week',
  },
  {
    id: 'g2',
    name: 'Pana Makers Co-op',
    purpose: 'Shared tools, shared storefronts',
    blurb:
      'A buying group for materials and a rotating booth at three markets. Dues are $15 a month and the books are public.',
    where: 'Miami-Dade',
    mode: 'hybrid',
    rhythm: 'Weekly call, Tuesdays',
    members: 34,
    tags: ['Makers', 'Co-op'],
    cover: '/img/impact/hero-mixer.webp',
    faces: FACES.slice(1, 4),
    joinPolicy: 'request',
    joined: false,
    activity: '4 posts this week',
  },
  {
    /* Online-only: no county, no venue, and a rhythm that is the only "where"
       it has. */
    id: 'g3',
    name: 'Night Shift Writers',
    purpose: 'Quiet co-writing after everyone goes to bed',
    blurb:
      'Cameras off, mics off, two 45-minute blocks. Nobody reads anybody else’s work unless they ask.',
    where: null,
    mode: 'online',
    rhythm: 'Sun–Thu, 10 PM',
    members: 17,
    tags: ['Writing', 'Online', 'Open to all'],
    cover: null,
    faces: FACES.slice(2, 4),
    joinPolicy: 'open',
    joined: true,
    activity: 'Active last night',
  },
  {
    id: 'g4',
    name: 'Little Haiti Growers',
    purpose: 'A garden plot and the people on it',
    blurb:
      'Saturday mornings at the lot on NE 2nd. Tools provided, bring water and a hat.',
    where: 'Little Haiti · Miami-Dade',
    mode: 'in-person',
    rhythm: 'Saturdays, 8 AM',
    members: 52,
    tags: ['Food', 'Outdoors'],
    cover: '/img/impact/culture-zines-left.webp',
    faces: FACES.slice(0, 2),
    joinPolicy: 'open',
    joined: false,
    activity: '2 posts this week',
  },
];

/**
 * A pana.
 *
 * The thinnest of the four on purpose. A member profile is mostly a name, a
 * face and one line about what they do, and padding that out with invented
 * slots is how the scope pages ended up rendering a 70px row for everything.
 * What this adds over today's row is the craft pills and the mutual count —
 * the two things that make a stranger worth following rather than merely a
 * matching string.
 */
export interface MockPana {
  id: string;
  name: string;
  handle: string;
  headline: string;
  /** Many members publish no neighbourhood. The layout has to survive it. */
  where: string | null;
  interests: string[];
  avatar: string;
  mutuals: number;
  followers: number;
  /** The business this pana is behind, if any. */
  runs: string | null;
}

export const PANAS: MockPana[] = [
  {
    id: 'p1',
    name: 'Maria Restrepo',
    handle: '@mariaceramics',
    headline: 'Ceramicist, teaches Tuesdays',
    where: 'Little Haiti',
    interests: ['Ceramics', 'Teaching'],
    avatar: FACES[1],
    mutuals: 6,
    followers: 40,
    runs: 'Taller Lucía',
  },
  {
    id: 'p2',
    name: 'Claribel Ávila',
    handle: '@claribel',
    headline: 'Runs pricing workshops for makers',
    where: 'Hollywood',
    interests: ['Business', 'Teaching'],
    avatar: FACES[2],
    mutuals: 2,
    followers: 118,
    runs: null,
  },
  {
    /* No neighbourhood published. */
    id: 'p3',
    name: 'Anette Mago',
    handle: '@anette',
    headline: 'Printmaker — riso, screen, anything flat',
    where: null,
    interests: ['Print', 'Zines'],
    avatar: FACES[0],
    mutuals: 11,
    followers: 73,
    runs: 'Barrio Arts Lab',
  },
  {
    id: 'p4',
    name: 'G. Barrios',
    handle: '@gbarrios',
    headline: 'Cooks for the long table dinners',
    where: 'Little River',
    interests: ['Food'],
    avatar: FACES[3],
    mutuals: 4,
    followers: 29,
    runs: 'El Fogón Food Truck',
  },
];

/**
 * Counts shown beside each scope in the menu.
 *
 * Businesses is larger than its three fixtures because the directory genuinely
 * is; the other three are derived from their arrays rather than typed, per the
 * README rule that a mock must not advertise a number it does not render.
 */
export const SCOPE_COUNTS: Record<ExploreScope, number> = {
  business: 17,
  event: EVENTS.length,
  group: GROUPS.length,
  pana: PANAS.length,
};

/**
 * What the join button says, per policy.
 *
 * Three labels rather than one, because "Join" on a request-only group is a
 * promise the next screen breaks — the member taps it expecting to be in and
 * lands on a form. The directory never had to make this distinction because
 * nothing in it could be joined.
 */
export const JOIN_LABEL: Record<MockGroup['joinPolicy'], string> = {
  open: 'Join',
  request: 'Request to join',
  invite: 'Invite only',
};
