/**
 * Fixtures for the scoped directory mock.
 *
 * Route: /mock/directory-scopes
 *
 * Every field is annotated with the column it stands in for, so swapping this
 * for a real query is mechanical rather than interpretive. Nothing here is
 * loaded from the database.
 *
 * The four kinds are deliberately NOT normalised into one shape. That is the
 * argument this mock is making: a pana has no address, a group has no location
 * column at all, and an event's coordinates live on a joined venue rather than
 * on the event itself. Flattening them into a single `Result` type would hide
 * exactly the differences that decide which view each scope needs.
 */

export const SCOPES = ['all', 'business', 'pana', 'group', 'event'] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_LABEL: Record<Scope, string> = {
  all: 'Everything',
  business: 'Businesses',
  pana: 'Panas',
  group: 'Groups',
  event: 'Events',
};

/**
 * Which scopes can show a map, and why.
 *
 * Businesses carry address_lat/address_lng. Events reach coordinates through
 * venues.lat/lng. Panas cannot: ADDRESS_FIELDS_CLEARED_ON_DOWNGRADE strips
 * locality and coordinates from personal accounts to limit FIPA exposure, so a
 * pana map would mean storing member home locations. Groups have no location
 * column in relay_groups at all.
 */
export const SCOPE_HAS_MAP: Record<Scope, boolean> = {
  all: false,
  business: true,
  pana: false,
  group: false,
  event: true,
};

/** Scopes only offered to signed-in visitors. */
export const SCOPE_REQUIRES_PANA: Record<Scope, boolean> = {
  all: false,
  business: false,
  pana: true,
  group: false,
  event: false,
};

/**
 * A colour token per scope, borrowed from the `[data-tone]` set in
 * `app/globals.css` that the panaverse switcher already uses.
 *
 * There are exactly five tones and exactly five scopes, which is luck rather
 * than design, but it earns its keep: the dropdown, the icon and the active
 * chip all read from this one map, so a kind cannot be burnt orange in the
 * menu and blue in the results. `all` takes indigo because indigo is the
 * brand default, and "everything" should look like the house rather than
 * like a fifth category competing with the other four.
 */
export const SCOPE_TONE: Record<Scope, string> = {
  all: 'indigo',
  business: 'burnt',
  pana: 'blue',
  group: 'flame',
  event: 'red',
};

/**
 * What each scope actually searches, in the menu's own words.
 *
 * These exist because the labels are nouns and nouns are ambiguous here —
 * "Groups" could plausibly mean businesses with multiple locations, and
 * "Panas" means nothing at all to someone on their first visit. One line of
 * plain description is the difference between a menu you read and a menu you
 * guess at.
 */
export const SCOPE_BLURB: Record<Scope, string> = {
  all: 'A few of each kind, then go deeper',
  business: 'Shops, makers, studios and venues',
  pana: 'Members by name or handle',
  group: 'Chat groups on the relay',
  event: 'Shows, markets and meetups',
};

export interface Coords {
  lat: number;
  lng: number;
}

export interface BusinessResult {
  kind: 'business';
  /** profiles.id */
  id: string;
  /** profiles.screenname — the /p/[handle] segment */
  slug: string;
  /** profiles.name */
  name: string;
  /** profiles.descriptions->>'fiveWords' */
  tagline: string;
  /** profiles.descriptions->>'details' */
  blurb: string;
  /** profiles.address_locality */
  city: string;
  /** profiles.address_lat / profiles.address_lng — null for online-only */
  coords: Coords | null;
  /** profiles.primary_image_cdn */
  logo: string;
  /** profiles.images[0] */
  cover: string;
  /** profiles.categories, flattened the way pana_jsonb_flags does */
  categories: string[];
  /** profiles.signals->>'certified' */
  certified: boolean;
  /** derived from profile_recommendations */
  recommendedCount: number;
}

export interface PanaResult {
  kind: 'pana';
  /** users.id */
  id: string;
  /** users.screenname */
  handle: string;
  /** profiles.name */
  name: string;
  /** profiles.descriptions->>'fiveWords' */
  bio: string;
  /** profiles.primary_image_cdn */
  avatar: string;
  /** users.created_at */
  joinedYear: number;
  /** count(relay_group_members) for this member */
  groupCount: number;
  /** groups the viewer and this pana share */
  sharedGroups: number;
}

export interface GroupResult {
  kind: 'group';
  /** relay_groups.group_id */
  id: string;
  /** relay_groups.name */
  name: string;
  /** relay_groups.about */
  about: string;
  /** relay_groups.picture */
  picture: string;
  /** count(relay_group_members) */
  memberCount: number;
  /** relay_groups.join_policy */
  joinPolicy: 'open' | 'invite_only';
}

export interface EventResult {
  kind: 'event';
  /** events.id */
  id: string;
  /** events.slug */
  slug: string;
  /** events.title */
  title: string;
  /** events.description */
  description: string;
  /** events.cover_image */
  cover: string;
  /** events.starts_at, held as an offset so the mock never goes stale */
  inDays: number;
  /** events.mode */
  mode: 'offline' | 'online';
  /** venues.name — null when mode is online */
  venueName: string | null;
  /** venues.city */
  city: string | null;
  /** venues.lat / venues.lng */
  coords: Coords | null;
  /** profiles.name, via events.host_profile_id */
  hostName: string;
  /** events.attendee_count */
  attendeeCount: number;
  /** events.attendee_cap */
  attendeeCap: number | null;
}

export type AnyResult = BusinessResult | PanaResult | GroupResult | EventResult;

/** Where the mock viewer is standing, for distance and the "You" pin. */
export const MOCK_VIEWER_COORDS: Coords = { lat: 25.801, lng: -80.199 };

export const businesses: BusinessResult[] = [
  {
    kind: 'business',
    id: 'b-allpeep',
    slug: 'allpeep-studio',
    name: 'AllPeep Studio',
    tagline: 'Risograph, zines, art printing',
    blurb:
      'A two-press riso shop that prints for local artists at cost one week a month.',
    city: 'Wynwood',
    coords: { lat: 25.8011, lng: -80.1994 },
    logo: '/img/impact/partner-allpeep.webp',
    cover: '/img/impact/culture-zines-left.webp',
    categories: ['art', 'printing'],
    certified: true,
    recommendedCount: 31,
  },
  {
    kind: 'business',
    id: 'b-taller',
    slug: 'taller-lucia',
    name: 'Taller Lucía',
    tagline: 'Handbound books, paper, repair',
    blurb:
      'Bookbinding and paper conservation, plus a Saturday art workshop for anyone who wants to learn.',
    city: 'Little Havana',
    coords: { lat: 25.7657, lng: -80.2198 },
    logo: '/img/impact/partner-dale.webp',
    cover: '/img/impact/zine-series.webp',
    categories: ['art', 'craft'],
    certified: false,
    recommendedCount: 18,
  },
  {
    kind: 'business',
    id: 'b-bohemian',
    slug: 'bohemian-kitchen',
    name: 'Bohemian Kitchen',
    tagline: 'Caribbean, plant-forward, loud',
    blurb:
      'Haitian and Cuban plates, mostly vegan, with the art wall rotating every month.',
    city: 'Little Haiti',
    coords: { lat: 25.8234, lng: -80.1912 },
    logo: '/img/impact/partner-our-florida.webp',
    cover: '/img/impact/pana-social-dinner.webp',
    categories: ['food', 'art'],
    certified: true,
    recommendedCount: 47,
  },
  {
    kind: 'business',
    id: 'b-subtropic',
    slug: 'subtropic-film',
    name: 'Subtropic Film Co-op',
    tagline: 'Super 8 processing, by mail',
    blurb:
      'Mail-in film processing and scanning for South Florida artists. No storefront.',
    city: 'Online only',
    coords: null,
    logo: '/img/impact/partner-subtropic-film-festival.webp',
    cover: '/img/impact/filmfest-collab-left.webp',
    categories: ['art', 'film'],
    certified: false,
    recommendedCount: 12,
  },
  {
    /* Broward, deliberately. The directory covers three counties, so at least
       one fixture has to sit far enough north that the map is doing work
       rather than decorating a single neighbourhood. */
    kind: 'business',
    id: 'b-bandera',
    slug: 'bandera-press',
    name: 'Bandera Press',
    tagline: 'Letterpress, posters, art editions',
    blurb:
      'A letterpress shop above a bike store. Runs a free poster night for local artists.',
    city: 'Fort Lauderdale',
    coords: { lat: 26.1224, lng: -80.1373 },
    logo: '/img/impact/partner-we-met-community.webp',
    cover: '/img/impact/hero-mixer.webp',
    categories: ['art', 'printing'],
    certified: true,
    recommendedCount: 26,
  },
];

export const panas: PanaResult[] = [
  {
    kind: 'pana',
    id: 'u-anette',
    handle: 'anette',
    name: 'Anette M.',
    bio: 'Organizer, art walks, community dinners',
    avatar: '/img/about/anette_mago.jpg',
    joinedYear: 2021,
    groupCount: 4,
    sharedGroups: 2,
  },
  {
    kind: 'pana',
    id: 'u-beemaria',
    handle: 'beemaria',
    name: 'Maria B.',
    bio: 'Zine maker, art teacher, riso obsessive',
    avatar: '/img/about/bee_maria.jpg',
    joinedYear: 2022,
    groupCount: 3,
    sharedGroups: 1,
  },
  {
    kind: 'pana',
    id: 'u-claribel',
    handle: 'claribel',
    name: 'Claribel A.',
    bio: 'Muralist and public art coordinator',
    avatar: '/img/about/claribel_avila.jpg',
    joinedYear: 2020,
    groupCount: 6,
    sharedGroups: 3,
  },
  {
    kind: 'pana',
    id: 'u-gbarrios',
    handle: 'gbarrios',
    name: 'G. Barrios',
    bio: 'Sound art, field recording, noise nights',
    avatar: '/img/about/gbarrios.jpg',
    joinedYear: 2023,
    groupCount: 2,
    sharedGroups: 0,
  },
  {
    kind: 'pana',
    id: 'u-jdowns',
    handle: 'jdowns',
    name: 'J. Downs',
    bio: 'Film programmer, archive nerd, art-house regular',
    avatar: '/img/about/jdowns.jpg',
    joinedYear: 2022,
    groupCount: 3,
    sharedGroups: 1,
  },
];

export const groups: GroupResult[] = [
  {
    kind: 'group',
    id: 'g-panamia-public',
    name: 'Pana MIA Public',
    about: 'The public Pana MIA group, bridged to the fediverse.',
    picture: '/img/impact/pana-social-app.webp',
    memberCount: 412,
    joinPolicy: 'open',
  },
  {
    kind: 'group',
    id: 'g-zine-makers',
    name: 'Zine Makers of Miami',
    about: 'Trades, print nights, and where to find cheap paper. Art welcome.',
    picture: '/img/impact/zine-series.webp',
    memberCount: 88,
    joinPolicy: 'open',
  },
  {
    kind: 'group',
    id: 'g-wynwood-artists',
    name: 'Wynwood Artists Collective',
    about: 'Studio shares and wall commissions. Invite only.',
    picture: '/img/impact/community-group.webp',
    memberCount: 34,
    joinPolicy: 'invite_only',
  },
  {
    kind: 'group',
    id: 'g-film-club',
    name: 'Subtropic Film Club',
    about: 'Monthly screenings, mostly 16mm, occasionally in a backyard.',
    picture: '/img/impact/filmmaker-participant.webp',
    memberCount: 61,
    joinPolicy: 'open',
  },
];

export const events: EventResult[] = [
  {
    kind: 'event',
    id: 'e-riso',
    slug: 'risograph-night',
    title: 'Risograph Night',
    description: 'Open press, bring art. Two colours, ten sheets each.',
    cover: '/img/impact/culture-zines-right.webp',
    inDays: 3,
    mode: 'online',
    venueName: null,
    city: null,
    coords: null,
    hostName: 'AllPeep Studio',
    attendeeCount: 22,
    attendeeCap: 40,
  },
  {
    kind: 'event',
    id: 'e-zine-swap',
    slug: 'zine-swap',
    title: 'Zine Swap + Art Table',
    description: 'Bring five, take five. Table space for anyone making art.',
    cover: '/img/impact/zine-series.webp',
    inDays: 6,
    mode: 'offline',
    venueName: 'La Esquina',
    city: 'Little Havana',
    coords: { lat: 25.7662, lng: -80.2201 },
    hostName: 'Taller Lucía',
    attendeeCount: 38,
    attendeeCap: 60,
  },
  {
    kind: 'event',
    id: 'e-croqueta',
    slug: 'vegan-croqueta-lab',
    title: 'Vegan Croqueta Lab',
    description: 'Six rounds, one fryer, plus the art wall opening.',
    cover: '/img/impact/pana-social-dinner.webp',
    inDays: 11,
    mode: 'offline',
    venueName: 'Bohemian Kitchen',
    city: 'Little Haiti',
    coords: { lat: 25.8231, lng: -80.1915 },
    hostName: 'Bohemian Kitchen',
    attendeeCount: 41,
    attendeeCap: 45,
  },
  {
    kind: 'event',
    id: 'e-heatwave',
    slug: 'heatwave-visions',
    title: 'Heatwave Visions — Screening',
    description: 'Short films by South Florida artists, 16mm and digital.',
    cover: '/img/impact/heatwave-visions.webp',
    inDays: 18,
    mode: 'offline',
    venueName: 'Sailboat Bend Annex',
    city: 'Fort Lauderdale',
    coords: { lat: 26.118, lng: -80.16 },
    hostName: 'Subtropic Film Co-op',
    attendeeCount: 15,
    attendeeCap: null,
  },
];

/* ------------------------------------------------------------------ query */

/** Everything a term is matched against, per kind. */
function haystack(result: AnyResult): string {
  switch (result.kind) {
    case 'business':
      return [
        result.name,
        result.tagline,
        result.blurb,
        result.city,
        ...result.categories,
      ].join(' ');
    case 'pana':
      return [result.name, result.handle, result.bio].join(' ');
    case 'group':
      return [result.name, result.about].join(' ');
    case 'event':
      return [
        result.title,
        result.description,
        result.hostName,
        result.venueName ?? '',
        result.city ?? '',
      ].join(' ');
  }
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Substring match, accent-folded.
 *
 * The real page would use the tsvector from migration 0040 plus the one this
 * design adds to events and relay_groups. Substring is close enough to review
 * a layout against, and deliberately naive so nobody mistakes the mock for the
 * ranking argument.
 */
function matches(result: AnyResult, term: string): boolean {
  const needle = fold(term.trim());
  if (!needle) return true;
  return fold(haystack(result)).includes(needle);
}

export interface ScopeResults {
  business: BusinessResult[];
  pana: PanaResult[];
  group: GroupResult[];
  event: EventResult[];
}

/**
 * Run the term against every kind at once.
 *
 * Counts on the scope selector come from this same call, so the mock cannot
 * advertise a number it does not render. `signedIn` gates panas here rather
 * than at the render site, because the rule is about what the query is allowed
 * to return, not about what the page chooses to draw.
 */
export function runQuery(term: string, signedIn: boolean): ScopeResults {
  return {
    business: businesses.filter((r) => matches(r, term)),
    pana: signedIn ? panas.filter((r) => matches(r, term)) : [],
    group: groups.filter((r) => matches(r, term)),
    event: events.filter((r) => matches(r, term)),
  };
}

export function countFor(results: ScopeResults, scope: Scope): number {
  if (scope === 'all') {
    return (
      results.business.length +
      results.pana.length +
      results.group.length +
      results.event.length
    );
  }
  return results[scope].length;
}

/* -------------------------------------------------------------- formatting */

const EARTH_RADIUS_MILES = 3958.8;

export function distanceMiles(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

export function formatDistance(miles: number): string {
  if (miles < 0.1) return 'here';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/** Event dates are offsets from today, so the mock never shows a past event. */
export function eventDate(inDays: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + inDays);
  return date;
}

export function formatEventWhen(inDays: number): string {
  const date = eventDate(inDays);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday}, ${month} ${date.getDate()}`;
}

export function formatCountdown(inDays: number): string {
  if (inDays === 0) return 'today';
  if (inDays === 1) return 'tomorrow';
  if (inDays < 7) return `in ${inDays} days`;
  const weeks = Math.round(inDays / 7);
  return weeks === 1 ? 'in a week' : `in ${weeks} weeks`;
}

export const CATEGORY_LABEL: Record<string, string> = {
  art: 'Art',
  craft: 'Craft',
  film: 'Film',
  food: 'Food',
  printing: 'Printing',
};
