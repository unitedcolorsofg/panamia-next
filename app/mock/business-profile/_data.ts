/**
 * Fixture data for the business-profile design mock.
 *
 * Nothing here is wired to the database — this file exists so the mock can be
 * reviewed as a page rather than a screenshot, and so the shape each section
 * needs is written down before anyone builds the real query. Treat the
 * interfaces below as the proposed contract for `getPublicProfile`, not as
 * final schema.
 */

export type LinkKind =
  | 'website'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'shop'
  | 'menu'
  | 'phone'
  | 'email';

export interface BusinessLink {
  kind: LinkKind;
  /** What the reader sees — a handle or domain, never a raw URL. */
  label: string;
  href: string;
}

export type EventRole = 'hosting' | 'vendor' | 'partner';

export interface BusinessEvent {
  id: string;
  title: string;
  /** Whole days from today. Resolved to a real date at render — see `eventDate`. */
  inDays: number;
  startTime: string;
  venue: string;
  city: string;
  role: EventRole;
  coverImage: string;
  href: string;
  /** Null until the event has a ticket page; renders as "Free / RSVP". */
  ticketHref: string | null;
}

export interface BusinessUpdate {
  id: string;
  body: string;
  /** Whole days before today. */
  agoDays: number;
  image: string | null;
  imageAlt: string | null;
  likes: number;
  replies: number;
  boosts: number;
}

export interface GalleryImage {
  src: string;
  alt: string;
}

export interface Coords {
  lat: number;
  lng: number;
}

export interface BusinessProfile {
  slug: string;
  name: string;
  /** The one-line "five words" the directory already collects. */
  tagline: string;
  logo: string;
  coverImage: string;
  coverAlt: string;
  categories: string[];
  city: string;
  county: string;
  /**
   * Where the business actually is. Distance is computed from this against
   * the viewer's own position rather than stored, because "how far away" is
   * a fact about a pair of people, not a property of the business.
   */
  coords: Coords;
  /** Set by Pana Mia staff, never by the business. Null when not certified. */
  certification: {
    certifiedOn: string;
    blurb: string;
  } | null;
  savedCount: number;
  recommendedCount: number;
  /** Recommenders shown as a stacked avatar row above the counts. */
  recommenderAvatars: string[];
  bio: string[];
  /** Short, scannable facts that sit beside the bio rather than inside it. */
  facts: { label: string; value: string }[];
  links: BusinessLink[];
  gallery: GalleryImage[];
  events: BusinessEvent[];
  /** Present only when a personal Pana account has claimed the listing. */
  claim: {
    screenname: string;
    displayName: string;
    avatar: string;
    claimedOn: string;
  } | null;
  updates: BusinessUpdate[];
}

export const businessProfileMock: BusinessProfile = {
  slug: 'bohemian-kitchen',
  name: 'Bohemian Kitchen',
  tagline: 'Venezuelan comfort food, made by hand',
  logo: '/img/impact/partner-dale.webp',
  coverImage: '/img/impact/pana-social-dinner.webp',
  coverAlt: 'Bohemian Kitchen serving plates at a Pana Mia community dinner',
  categories: ['Food & Drink', 'Catering', 'Pop-Ups'],
  city: 'Little Haiti',
  county: 'Miami-Dade',
  coords: { lat: 25.8237, lng: -80.1918 },

  certification: {
    certifiedOn: 'March 2025',
    blurb:
      'Verified by Pana Mia staff as locally owned, fairly run, and rooted in South Florida.',
  },

  savedCount: 412,
  recommendedCount: 168,
  recommenderAvatars: [
    '/img/about/anette_mago.jpg',
    '/img/about/bee_maria.jpg',
    '/img/about/claribel_avila.jpg',
    '/img/about/gbarrios.jpg',
    '/img/about/jdowns.jpg',
  ],

  bio: [
    'Bohemian Kitchen started as a Sunday arepa table on NE 2nd Avenue and never really stopped being one. Everything is cooked to order, in small batches, by a family that has been feeding this neighbourhood for eleven years.',
    'We cater community dinners, artist openings, and the kind of birthday party where nobody wants to leave. If you have seen us at a Pana Mia mixer, you have probably already eaten our food.',
  ],

  facts: [
    { label: 'Founded', value: '2014' },
    { label: 'Owned by', value: 'The Rivas family' },
    { label: 'Languages', value: 'Español / English' },
    { label: 'Good for', value: 'Catering, pop-ups, large groups' },
  ],

  links: [
    { kind: 'website', label: 'bohemiankitchen.com', href: '#' },
    { kind: 'menu', label: 'See the menu', href: '#' },
    { kind: 'instagram', label: '@bohemiankitchenmia', href: '#' },
    { kind: 'tiktok', label: '@bohemiankitchen', href: '#' },
    { kind: 'facebook', label: 'Bohemian Kitchen', href: '#' },
    { kind: 'phone', label: '(305) 555-0148', href: '#' },
  ],

  gallery: [
    {
      src: '/img/impact/hero-mixer.webp',
      alt: 'Plates being served at a Pana Mia mixer',
    },
    {
      src: '/img/impact/community-group.webp',
      alt: 'Guests gathered around the Bohemian Kitchen table',
    },
    {
      src: '/img/impact/zine-series.webp',
      alt: 'Regulars flipping through the zine we printed with a neighbouring shop',
    },
    {
      src: '/img/impact/filmfest-collab-left.webp',
      alt: 'The Bohemian Kitchen pop-up stall at a street market',
    },
    {
      src: '/img/impact/filmfest-collab-right.webp',
      alt: 'The Bohemian Kitchen team and guests after a catered dinner',
    },
  ],

  // Deliberately spread across the coming quarter so the "next 3 months"
  // framing has something to show at both ends of the window.
  events: [
    {
      id: 'evt-1',
      title: 'Pana Mia Mixer: Little Haiti',
      inDays: 9,
      startTime: '7:00 PM',
      venue: 'Center for Subtropical Affairs',
      city: 'Miami',
      role: 'vendor',
      coverImage: '/img/impact/hero-mixer.webp',
      href: '#',
      ticketHref: '#',
    },
    {
      id: 'evt-2',
      title: 'Sunday Arepa Pop-Up',
      inDays: 24,
      startTime: '11:00 AM',
      venue: 'Legion Park Farmers Market',
      city: 'Miami',
      role: 'hosting',
      coverImage: '/img/home/EventsBanner.webp',
      href: '#',
      ticketHref: null,
    },
    {
      id: 'evt-3',
      title: '10 Days of Connection — Community Dinner',
      inDays: 52,
      startTime: '6:30 PM',
      venue: 'Miami Workers Center',
      city: 'Liberty City',
      role: 'partner',
      coverImage: '/img/impact/pana-social-dinner.webp',
      href: '#',
      ticketHref: '#',
    },
    {
      id: 'evt-4',
      title: 'Subtropic Film Festival: Closing Night',
      inDays: 78,
      startTime: '8:00 PM',
      venue: 'O Cinema South Beach',
      city: 'Miami Beach',
      role: 'vendor',
      coverImage: '/img/impact/heatwave-visions.webp',
      href: '#',
      ticketHref: '#',
    },
  ],

  claim: {
    screenname: 'carmenrivas',
    displayName: 'Carmen Rivas',
    avatar: '/img/about/claribel_avila.jpg',
    claimedOn: 'January 2025',
  },

  updates: [
    {
      id: 'upd-1',
      body: 'Catering slots for December are open as of this morning. We take eight a month and they tend to go in about a week — message us here or through the site.',
      agoDays: 2,
      image: null,
      imageAlt: null,
      likes: 64,
      replies: 11,
      boosts: 7,
    },
    {
      id: 'upd-2',
      body: 'Thank you to everyone who came out to the mixer on Saturday. We made 340 arepas and went home with none. See you at Legion Park.',
      agoDays: 6,
      image: '/img/impact/filmmaker-participant.webp',
      imageAlt: 'A guest at the mixer with a cold horchata',
      likes: 203,
      replies: 28,
      boosts: 41,
    },
    {
      id: 'upd-3',
      body: 'New on the menu: pabellón bowls, weekends only. Same beans our grandmother has been making since before any of us were born.',
      agoDays: 13,
      image: null,
      imageAlt: null,
      likes: 97,
      replies: 15,
      boosts: 12,
    },
  ],
};

/**
 * Resolve a day-offset fixture into a real Date.
 *
 * Anchored to UTC midnight rather than `new Date()` so the server render and
 * the client hydration agree on the day. A raw `Date.now()` here would drift
 * between the two passes and React would flag the mismatch.
 */
export function eventDate(offsetInDays: number): Date {
  const now = new Date();
  const utcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return new Date(utcMidnight + offsetInDays * 86_400_000);
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Formatted by hand, in UTC, for the same hydration reason as `eventDate`. */
export function formatEventDate(date: Date) {
  return {
    month: MONTHS[date.getUTCMonth()],
    day: String(date.getUTCDate()),
    weekday: WEEKDAYS[date.getUTCDay()],
  };
}

export function formatRelativeDays(days: number) {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export const EVENT_ROLE_LABEL: Record<EventRole, string> = {
  hosting: 'Hosting',
  vendor: 'Vendor',
  partner: 'Partner',
};

/**
 * Stands in for the viewer's real position, which the live page would get
 * from the browser's geolocation prompt or a saved home neighbourhood.
 * Wynwood, so the demo distance is the short walk-or-short-drive kind the
 * directory is actually for.
 */
export const MOCK_VIEWER_COORDS: Coords = { lat: 25.801, lng: -80.199 };

const EARTH_RADIUS_MILES = 3958.8;

/** Great-circle distance. Deterministic, so it is hydration-safe. */
export function distanceInMiles(from: Coords, to: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

/**
 * Round to the precision the number actually carries.
 *
 * A distance derived from a neighbourhood centroid is not accurate to three
 * decimals, and printing "1.634 miles away" claims a precision the directory
 * does not have. Close by gets one decimal because the difference between
 * half a mile and two miles decides whether you walk; past ten miles the
 * decimal stops meaning anything.
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return 'less than 0.1 miles away';
  if (miles < 10) {
    const rounded = Math.round(miles * 10) / 10;
    return `${rounded} ${rounded === 1 ? 'mile' : 'miles'} away`;
  }
  return `${Math.round(miles)} miles away`;
}
