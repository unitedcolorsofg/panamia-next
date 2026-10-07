/**
 * Fixtures for /mock/events — the events discover page.
 *
 * The argument of this mock is in the difference between two questions. The
 * live `/e` page answers "list every upcoming event" and `/directory/events`
 * answers "which events match this word". Neither answers the question an
 * actual person arrives with, which is "what is on, near me, soon, that I
 * would like" — a question nobody can type into a search box because it has
 * four clauses and three of them are not words.
 *
 * So the shape below is not a list of events. It is a list of events carrying
 * the four facts that question is made of: *when* (bucket, day), *where*
 * (where, mode), *what kind* (type, tags) and *who else* (going, faces,
 * followedGoing). Every section of the page uses one of those four as its
 * organising axis, which is why the fixtures carry each one explicitly rather
 * than leaving the page to infer it from a timestamp.
 *
 * Fields are annotated with the column they stand in for, per
 * app/mock/README.md, so wiring this to real data is mechanical. Nothing here
 * reads the database and nothing here is localized.
 *
 * Dates are written as labels rather than as `Date` objects on purpose. A mock
 * that computes "this weekend" from `Date.now()` renders differently depending
 * on the day the reviewer opens it, and a design review that disagrees with
 * itself on a Monday is not a review.
 */

/** Which of the When chips an event falls under. Derived in production from
 *  `events.startsAt` against the viewer's timezone; fixed here so the mock
 *  reads the same on any day of the week. */
export type WhenBucket = 'today' | 'weekend' | 'month';

/** The Type facet. Production derives this from `events.tags`; the directory
 *  has no `events.category` column and this mock does not propose adding one —
 *  the tag vocabulary is already the thing hosts actually fill in. */
export type EventType = 'market' | 'workshop' | 'show' | 'mixer' | 'talk';

/** The Where facet, keyed the way `lib/lists` writes counties so the mock's
 *  values are the production values. `online` is not a county and that is the
 *  point: an online event belongs to no county, so without a term for it the
 *  Where menu would silently drop it from every answer. */
export type EventCounty = 'miami_dade' | 'broward' | 'palm_beach' | 'online';

/** The Sort facet. `closest` needs a location to measure from and is offered
 *  disabled, the same way the live filter bar offers "Nearest". */
export type EventSort = 'soonest' | 'going' | 'closest';

export interface MockEvent {
  /** events.id */
  id: string;
  /** events.slug — the card links to /e/<slug>, which is already live. */
  slug: string;
  /** events.title */
  title: string;
  /** events.coverImage. Null renders the tinted fallback panel. */
  cover: string | null;
  /** events.description, clamped to two lines by .dirsearch-card-blurb. */
  blurb: string;
  /** events.mode */
  mode: 'offline' | 'online' | 'hybrid';
  /** events.startsAt, already formatted in events.timezone. */
  when: string;
  /** Which When chip this answers to. */
  bucket: WhenBucket;
  /** Short label for the date strip, e.g. "Fri 20". One per calendar day. */
  day: string;
  /** venues.name · venues.city, or "Online" when mode is online. */
  where: string;
  /** venues.county, for the Where facet. `online` when there is no venue. */
  county: EventCounty;
  /** eventRsvps rows with status 'going'. */
  going: number;
  /** events.attendeeCap. Null means uncapped. */
  cap: number | null;
  /** events.tags */
  tags: string[];
  type: EventType;
  /** profiles.primaryImageCdn for attendees the viewer follows. */
  faces: string[];
  /** profiles.name of the host — events.hostProfileId. */
  host: string;
  /** Door price as the host wrote it. Free is the common case and is said
   *  plainly rather than as "$0". */
  price: string;
  /**
   * How many of the going are panas the viewer follows.
   *
   * This is the only viewer-dependent field on the record, and the "Panas you
   * follow" section is built entirely on it. Signed out it is not merely zero,
   * it is unknowable — so that section becomes the reason to sign in rather
   * than a heading over an empty list. Same distinction the directory draws
   * between a scope being gated and a scope matching nothing.
   */
  followedGoing: number;
}

const FACES = [
  '/img/about/anette_mago.jpg',
  '/img/about/bee_maria.jpg',
  '/img/about/claribel_avila.jpg',
  '/img/about/gbarrios.jpg',
  '/img/about/jdowns.jpg',
];

/* Kept in strict chronological order, because both the date strip and the day
   groups derive their order from this array rather than sorting it. That is
   deliberate: the real query ends in `ORDER BY starts_at`, so the mock should
   fail the same way the product would if a row ever came back out of order,
   rather than paper over it with a client-side sort the server already owes. */
export const MOCK_EVENTS: MockEvent[] = [
  {
    id: 'e1',
    slug: 'little-haiti-night-market',
    title: 'Little Haiti Night Market',
    cover: '/img/directory/market-01.jpg',
    blurb:
      'Forty makers, two food trucks and a sound system under the banyans. Rain or shine, we move under the pavilion.',
    mode: 'offline',
    when: 'Tonight, 6:00 PM',
    bucket: 'today',
    day: 'Thu 19',
    where: 'Little Haiti Cultural Complex · Miami',
    county: 'miami_dade',
    going: 212,
    cap: null,
    tags: ['Market', 'Free', 'Family'],
    type: 'market',
    faces: FACES.slice(0, 3),
    host: 'Pana Mia Club',
    price: 'Free',
    followedGoing: 4,
  },
  {
    id: 'e2',
    slug: 'risograph-open-studio',
    title: 'Risograph Open Studio',
    cover: '/img/impact/culture-zines-right.webp',
    blurb:
      'Bring a file, leave with a print run. Two drums loaded, paper provided, first twelve people only.',
    mode: 'offline',
    when: 'Tonight, 7:30 PM',
    bucket: 'today',
    day: 'Thu 19',
    where: 'Barrio Arts Lab · Delray Beach',
    county: 'palm_beach',
    going: 11,
    cap: 12,
    tags: ['Print', 'Workshop', 'Zines'],
    type: 'workshop',
    faces: FACES.slice(2, 4),
    host: 'Barrio Arts Lab',
    price: '$15',
    followedGoing: 2,
  },
  {
    id: 'e3',
    slug: 'heatwave-visions-opening',
    title: 'Heatwave Visions: Opening Night',
    cover: '/img/impact/heatwave-visions.webp',
    blurb:
      'Twelve South Florida artists on heat, water and the year the summer did not end. Free, cash bar.',
    mode: 'offline',
    when: 'Fri 20 Feb, 7:00 PM',
    bucket: 'weekend',
    day: 'Fri 20',
    where: 'Bakehouse Art Complex · Wynwood',
    county: 'miami_dade',
    going: 148,
    cap: 300,
    tags: ['Art', 'Free', 'Opening'],
    type: 'show',
    faces: FACES.slice(0, 4),
    host: 'Subtropic Collective',
    price: 'Free',
    followedGoing: 7,
  },
  {
    id: 'e4',
    slug: 'pana-mixer-broward',
    title: 'Pana Mixer: Broward',
    cover: '/img/impact/hero-mixer.webp',
    blurb:
      'The monthly one. No pitches, no panel, no name tags — just panas in a room with arepas.',
    mode: 'offline',
    when: 'Fri 20 Feb, 6:30 PM',
    bucket: 'weekend',
    day: 'Fri 20',
    where: 'The Annex · Fort Lauderdale',
    county: 'broward',
    going: 64,
    cap: 80,
    tags: ['Mixer', 'Members'],
    type: 'mixer',
    faces: FACES.slice(1, 5),
    host: 'Pana Mia Club',
    price: 'Free',
    followedGoing: 9,
  },
  {
    id: 'e5',
    slug: 'supper-club-six-courses',
    title: 'Supper Club: Six Courses, One Table',
    cover: '/img/directory/supper-club-02.jpg',
    blurb:
      'One long table, eighteen seats, a menu nobody sees until it lands. Dietary notes taken at booking.',
    mode: 'offline',
    when: 'Sat 21 Feb, 7:00 PM',
    bucket: 'weekend',
    day: 'Sat 21',
    where: 'Casa Mariposa · Coral Gables',
    county: 'miami_dade',
    going: 18,
    cap: 18,
    tags: ['Food', 'Ticketed'],
    type: 'mixer',
    faces: FACES.slice(0, 2),
    host: 'Lucía Serrano',
    price: '$65',
    followedGoing: 1,
  },
  {
    id: 'e6',
    slug: 'screenprint-your-own-tote',
    title: 'Screenprint Your Own Tote',
    cover: '/img/directory/apparel-02.jpg',
    blurb:
      'Two hours, one screen, as many pulls as the ink allows. Totes included; bring a shirt if you want.',
    mode: 'offline',
    when: 'Sat 21 Feb, 11:00 AM',
    bucket: 'weekend',
    day: 'Sat 21',
    where: 'Taller Lucía · Little Havana',
    county: 'miami_dade',
    going: 22,
    cap: 24,
    tags: ['Print', 'Workshop', 'Beginner'],
    type: 'workshop',
    faces: FACES.slice(2, 5),
    host: 'Taller Lucía',
    price: '$30',
    followedGoing: 3,
  },
  {
    id: 'e7',
    slug: 'grant-writing-for-artists',
    title: 'Grant Writing for Artists, Plainly',
    cover: null,
    blurb:
      'What a panel actually reads, what it skips, and the four sentences that decide it. Bring a draft.',
    mode: 'online',
    when: 'Sun 22 Feb, 4:00 PM',
    bucket: 'weekend',
    day: 'Sun 22',
    where: 'Online',
    county: 'online',
    going: 93,
    cap: null,
    tags: ['Talk', 'Funding', 'Free'],
    type: 'talk',
    faces: FACES.slice(3, 5),
    host: 'Miami Artist Census',
    price: 'Free',
    followedGoing: 5,
  },
  {
    id: 'e8',
    slug: 'sunday-growers-market',
    title: "Sunday Growers' Market",
    cover: '/img/directory/market-03.jpg',
    blurb:
      'Twenty-odd growers from Homestead up. Cash is kindest; most stalls take cards anyway.',
    mode: 'offline',
    when: 'Sun 22 Feb, 9:00 AM',
    bucket: 'weekend',
    day: 'Sun 22',
    where: 'Pinecrest Gardens · Pinecrest',
    county: 'miami_dade',
    going: 310,
    cap: null,
    tags: ['Market', 'Free', 'Family'],
    type: 'market',
    faces: FACES.slice(0, 3),
    host: 'Our Florida',
    price: 'Free',
    followedGoing: 2,
  },
  {
    id: 'e11',
    slug: 'ceramics-wheel-intro',
    title: 'Wheel Throwing, From Nothing',
    cover: '/img/directory/artisanal-01.jpg',
    blurb:
      'Four hands, one wheel, three hours. You leave with two pieces and they fire them for you.',
    mode: 'offline',
    when: 'Tue 24 Feb, 6:00 PM',
    bucket: 'month',
    day: 'Tue 24',
    where: 'Maria Restrepo Studio · Little Haiti',
    county: 'miami_dade',
    going: 8,
    cap: 8,
    tags: ['Ceramics', 'Workshop'],
    type: 'workshop',
    faces: FACES.slice(1, 3),
    host: 'Maria Restrepo',
    price: '$80',
    followedGoing: 1,
  },
  {
    id: 'e12',
    slug: 'what-the-county-owes-you',
    title: 'What the County Owes You',
    cover: '/img/impact/partner-miami-workers-center.webp',
    blurb:
      'Tenant rights, wage theft and the three forms that actually move. Interpreters in the room.',
    mode: 'offline',
    when: 'Wed 25 Feb, 6:30 PM',
    bucket: 'month',
    day: 'Wed 25',
    where: 'Miami Workers Center · Liberty City',
    county: 'miami_dade',
    going: 56,
    cap: null,
    tags: ['Talk', 'Free', 'Rights'],
    type: 'talk',
    faces: FACES.slice(2, 5),
    host: 'Miami Workers Center',
    price: 'Free',
    followedGoing: 3,
  },
  {
    id: 'e9',
    slug: 'subtropic-shorts-night',
    title: 'Subtropic Shorts Night',
    cover: '/img/impact/filmmaker-participant.webp',
    blurb:
      'Nine shorts under twelve minutes, all shot in the tri-county. Directors stay for questions.',
    mode: 'hybrid',
    when: 'Thu 26 Feb, 8:00 PM',
    bucket: 'month',
    day: 'Thu 26',
    where: 'O Cinema · South Beach',
    county: 'miami_dade',
    going: 77,
    cap: 120,
    tags: ['Film', 'Ticketed'],
    type: 'show',
    faces: FACES.slice(1, 4),
    host: 'Subtropic Film Festival',
    price: '$12',
    followedGoing: 6,
  },
  {
    id: 'e10',
    slug: 'mutual-aid-build-night',
    title: 'Mutual Aid Build Night',
    cover: '/img/impact/community-group.webp',
    blurb:
      'Packing hurricane kits for the Resilience Network. Two hours, no experience needed, pizza after.',
    mode: 'offline',
    when: 'Sat 28 Feb, 2:00 PM',
    bucket: 'month',
    day: 'Sat 28',
    where: 'Miami Workers Center · Liberty City',
    county: 'miami_dade',
    going: 41,
    cap: 60,
    tags: ['Mutual aid', 'Free', 'Volunteer'],
    type: 'mixer',
    faces: FACES.slice(0, 4),
    host: 'Resilience Network',
    price: 'Free',
    followedGoing: 8,
  },
];

/** The When chips, in the order the rail shows them. `all` is last rather than
 *  first because a discover page opens on the narrow answer — what is on now —
 *  and widening the window is the deliberate act. */
export const WHEN_CHIPS: { key: WhenBucket | 'all'; label: string }[] = [
  { key: 'today', label: 'Tonight' },
  { key: 'weekend', label: 'This weekend' },
  { key: 'month', label: 'Later this month' },
  { key: 'all', label: 'Any time' },
];

/** The Type chips. Labels are plural because they name a set, not an item. */
export const TYPE_CHIPS: { key: EventType; label: string }[] = [
  { key: 'market', label: 'Markets' },
  { key: 'workshop', label: 'Workshops' },
  { key: 'show', label: 'Shows' },
  { key: 'mixer', label: 'Gatherings' },
  { key: 'talk', label: 'Talks' },
];

/** Counties as `lib/lists` writes them, plus Online. "Near me" leads because
 *  it is the answer most people want, and is offered disabled for the same
 *  reason the live filter bar disables "Nearest": there is nothing to measure
 *  from until the viewer shares a location, and an option that silently
 *  returns an order you cannot account for is worse than one you cannot pick. */
export const WHERE_OPTIONS: {
  key: EventCounty | 'near';
  label: string;
  needsLocation?: boolean;
}[] = [
  { key: 'near', label: 'Near me', needsLocation: true },
  { key: 'miami_dade', label: 'Miami-Dade' },
  { key: 'broward', label: 'Broward' },
  { key: 'palm_beach', label: 'Palm Beach' },
  { key: 'online', label: 'Online' },
];

export const SORT_OPTIONS: {
  key: EventSort;
  label: string;
  needsLocation?: boolean;
}[] = [
  { key: 'soonest', label: 'Soonest' },
  { key: 'going', label: 'Most going' },
  { key: 'closest', label: 'Closest', needsLocation: true },
];

/**
 * The host whose chrome this page is being designed for.
 *
 * Stated once, here, because three separate pieces of the mock render it — the
 * toolbar address, the masthead, and the Events tile in the account menu — and
 * the whole point of the mock is that those three agree.
 *
 * `directory.pana.social` is not a surface in `lib/panaverse/surfaces.ts`
 * today; the registry holds www, social, connectors and admin, so this
 * hostname would currently fall back to www. This mock is the argument for
 * promoting the directory to the fifth surface, with events as a room inside
 * it rather than a hostname of its own — markets and workshops are how people
 * find the makers, so they belong next to the makers.
 */
export const MOCK_HOST = 'directory.pana.social';
export const MOCK_PATH = '/events';
