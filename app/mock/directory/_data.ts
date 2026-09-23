/**
 * Fixture data for the directory search design mock.
 *
 * Route: /mock/directory
 *
 * Same contract as `app/mock/business-profile/_data.ts`: nothing here touches
 * the database. It exists so the redesign can be reviewed as a working page,
 * and so the shape a good result card needs is written down before anyone
 * extends the real query.
 *
 * That shape matters, because today's `SearchResultsInterface` cannot render
 * the card below. It carries name, five_words, details, city, and one image —
 * no logo, no categories, no certification, and no counts. Everything this
 * mock adds is already stored somewhere (`profile_signals`, the certification
 * flag, the category list); it has simply never been joined into search. The
 * interface below is the proposed join, not new schema.
 */

// Distance phrasing is imported rather than re-written so the card and the
// profile page cannot drift apart. "2.1 miles away" has to mean the same
// thing, and round the same way, on both screens.
export {
  distanceInMiles,
  formatDistance,
  MOCK_VIEWER_COORDS,
  type Coords,
} from '../business-profile/_data';

import { distanceInMiles, type Coords } from '../business-profile/_data';

export interface DirectoryResult {
  id: string;
  slug: string;
  name: string;
  /** The "five words" the directory already collects. */
  tagline: string;
  logo: string;
  coverImage: string;
  coverAlt: string;
  /** Values from `profileCategoryList`, not display strings. */
  categories: string[];
  city: string;
  /** Value from `countyList`. */
  county: string;
  /**
   * Null for online-only businesses. A stored address for one of those is
   * usually the owner's home, so there is nothing here to measure against and
   * nothing we should be publishing a distance to.
   */
  coords: Coords | null;
  onlineOnly: boolean;
  /** Set by Pana Mia staff, never by the business. */
  certified: boolean;
  /** False for a listing no pana account has claimed yet. */
  claimed: boolean;
  savedCount: number;
  recommendedCount: number;
  recommenderAvatars: string[];
  /**
   * The soonest event in the next three months, if any.
   *
   * On a result card this earns its space twice over: it is the only field
   * that gives someone a reason to act this week rather than bookmark and
   * forget, and it doubles as proof the listing is alive.
   */
  nextEvent: { title: string; inDays: number } | null;
  /** Days since the last Pana Social post. Null when never posted. */
  lastUpdateDays: number | null;
  blurb: string;
}

export const COUNTY_LABEL: Record<string, string> = {
  palm_beach: 'Palm Beach',
  broward: 'Broward',
  miami_dade: 'Miami-Dade',
};

export const CATEGORY_LABEL: Record<string, string> = {
  products: 'Products',
  services: 'Services',
  Venue: 'Venues',
  music: 'Music',
  food: 'Food',
  apparel: 'Apparel',
  art: 'Art',
  tech: 'Tech',
  wellness: 'Wellness',
  non_profit: 'Non-Profit',
  artisanal: 'Artisanal',
};

export const directoryResults: DirectoryResult[] = [
  {
    id: 'biz-1',
    slug: 'bohemian-kitchen',
    name: 'Bohemian Kitchen',
    tagline: 'Venezuelan comfort food, made by hand',
    logo: '/img/impact/partner-dale.webp',
    coverImage: '/img/impact/pana-social-dinner.webp',
    coverAlt: 'Plates being served at a Bohemian Kitchen community dinner',
    categories: ['food', 'artisanal'],
    city: 'Little Haiti',
    county: 'miami_dade',
    coords: { lat: 25.8237, lng: -80.1918 },
    onlineOnly: false,
    certified: true,
    claimed: true,
    savedCount: 412,
    recommendedCount: 168,
    recommenderAvatars: [
      '/img/about/anette_mago.jpg',
      '/img/about/bee_maria.jpg',
      '/img/about/claribel_avila.jpg',
      '/img/about/gbarrios.jpg',
    ],
    nextEvent: { title: 'Sunday Arepa Pop-Up', inDays: 4 },
    lastUpdateDays: 2,
    blurb:
      'Cooked to order, in small batches, by a family that has been feeding this neighbourhood for eleven years.',
  },
  {
    id: 'biz-2',
    slug: 'tinta-press',
    name: 'Tinta Press',
    tagline: 'Risograph printing for small runs',
    logo: '/img/impact/partner-miami-artist-census.webp',
    coverImage: '/img/impact/zine-series.webp',
    coverAlt: 'Zines fresh off the press at Tinta Press',
    categories: ['art', 'services', 'artisanal'],
    city: 'Wynwood',
    county: 'miami_dade',
    coords: { lat: 25.8008, lng: -80.1991 },
    onlineOnly: false,
    certified: true,
    claimed: true,
    savedCount: 287,
    recommendedCount: 94,
    recommenderAvatars: ['/img/about/jdowns.jpg', '/img/about/bee_maria.jpg'],
    nextEvent: { title: 'Zine Fair: Open Studio', inDays: 17 },
    lastUpdateDays: 5,
    blurb:
      'Two-colour riso, hand-bound. They print most of the zines you have picked up at a Pana Mia table.',
  },
  {
    id: 'biz-3',
    slug: 'casa-verde-wellness',
    name: 'Casa Verde Wellness',
    tagline: 'Community acupuncture, sliding scale',
    logo: '/img/impact/partner-radical-partners.webp',
    coverImage: '/img/impact/community-group.webp',
    coverAlt: 'A group session at Casa Verde Wellness',
    categories: ['wellness', 'services'],
    city: 'Little Havana',
    county: 'miami_dade',
    coords: { lat: 25.765, lng: -80.22 },
    onlineOnly: false,
    certified: false,
    claimed: true,
    savedCount: 156,
    recommendedCount: 71,
    recommenderAvatars: ['/img/about/claribel_avila.jpg'],
    nextEvent: null,
    lastUpdateDays: 19,
    blurb:
      'Nobody is turned away. Walk-ins Thursday through Sunday, Spanish and English.',
  },
  {
    id: 'biz-4',
    slug: 'the-citrus-room',
    name: 'The Citrus Room',
    tagline: 'Listening bar and record shop',
    logo: '/img/impact/culture-zines-left.webp',
    coverImage: '/img/impact/hero-mixer.webp',
    coverAlt: 'A packed night at The Citrus Room',
    categories: ['Venue', 'music'],
    city: 'Downtown Miami',
    county: 'miami_dade',
    coords: { lat: 25.7743, lng: -80.1937 },
    onlineOnly: false,
    certified: true,
    claimed: true,
    savedCount: 631,
    recommendedCount: 240,
    recommenderAvatars: [
      '/img/about/gbarrios.jpg',
      '/img/about/anette_mago.jpg',
      '/img/about/jdowns.jpg',
      '/img/about/bee_maria.jpg',
      '/img/about/claribel_avila.jpg',
    ],
    nextEvent: { title: 'Pana Mia Mixer: Downtown', inDays: 9 },
    lastUpdateDays: 1,
    blurb:
      'Salsa dura on the good system, and the only place downtown that will let you play your own record.',
  },
  {
    id: 'biz-5',
    slug: 'mangrove-goods',
    name: 'Mangrove Goods',
    tagline: 'Screen-printed tees, made in Hialeah',
    logo: '/img/impact/partner-our-florida.webp',
    coverImage: '/img/impact/culture-zines-left.webp',
    coverAlt: 'Screen-printed shirts drying on the rack',
    categories: ['apparel', 'products', 'artisanal'],
    city: 'Hialeah',
    county: 'miami_dade',
    coords: { lat: 25.8576, lng: -80.2781 },
    onlineOnly: false,
    certified: false,
    claimed: false,
    savedCount: 88,
    recommendedCount: 23,
    recommenderAvatars: ['/img/about/jdowns.jpg'],
    nextEvent: null,
    lastUpdateDays: null,
    blurb:
      'Every shirt pulled by hand in a garage off West 4th. Wholesale and one-offs both fine.',
  },
  {
    id: 'biz-6',
    slug: 'solar-punk-studio',
    name: 'Solar Punk Studio',
    tagline: 'Web design for small local business',
    logo: '/img/impact/partner-allpeep.webp',
    coverImage: '/img/impact/pana-social-app.webp',
    coverAlt: 'A site built by Solar Punk Studio on a laptop screen',
    categories: ['tech', 'services'],
    city: 'Remote',
    county: 'miami_dade',
    coords: null,
    onlineOnly: true,
    certified: false,
    claimed: true,
    savedCount: 134,
    recommendedCount: 52,
    recommenderAvatars: ['/img/about/bee_maria.jpg', '/img/about/gbarrios.jpg'],
    nextEvent: null,
    lastUpdateDays: 8,
    blurb:
      'Flat-rate sites for panas who have been quoted five figures by an agency. No retainers.',
  },
  {
    id: 'biz-7',
    slug: 'vecinos-bike-co',
    name: 'Vecinos Bike Co.',
    tagline: 'Repairs, refurbs, and free tune-ups',
    logo: '/img/impact/partner-miami-workers-center.webp',
    coverImage: '/img/impact/filmmaker-participant.webp',
    coverAlt: 'A bike being tuned up at Vecinos',
    categories: ['services', 'non_profit'],
    city: 'Hollywood',
    county: 'broward',
    coords: { lat: 26.0112, lng: -80.1495 },
    onlineOnly: false,
    certified: true,
    claimed: true,
    savedCount: 203,
    recommendedCount: 119,
    recommenderAvatars: [
      '/img/about/anette_mago.jpg',
      '/img/about/claribel_avila.jpg',
      '/img/about/jdowns.jpg',
    ],
    nextEvent: { title: 'Free Tune-Up Saturday', inDays: 11 },
    lastUpdateDays: 3,
    blurb:
      'A shop that fixes your bike and a non-profit that gives them away, run out of the same two bays.',
  },
  {
    id: 'biz-8',
    slug: 'la-ventana-arts',
    name: 'La Ventana Arts',
    tagline: 'Gallery and printmaking workshops',
    logo: '/img/impact/filmmaker-participant.webp',
    coverImage: '/img/impact/filmfest-collab-left.webp',
    coverAlt: 'An opening night at La Ventana Arts',
    categories: ['art', 'Venue', 'non_profit'],
    city: 'Fort Lauderdale',
    county: 'broward',
    coords: { lat: 26.1224, lng: -80.1373 },
    onlineOnly: false,
    certified: false,
    claimed: true,
    savedCount: 97,
    recommendedCount: 38,
    recommenderAvatars: ['/img/about/gbarrios.jpg'],
    nextEvent: { title: 'Open Call: Winter Show', inDays: 33 },
    lastUpdateDays: 26,
    blurb:
      'Free workshops on the first Sunday. The back room is a studio you can rent by the day.',
  },
  {
    id: 'biz-9',
    slug: 'mama-yoli-catering',
    name: 'Mama Yoli Catering',
    tagline: 'Haitian home cooking for events',
    logo: '/img/impact/partner-10-days-of-connection.webp',
    coverImage: '/img/home/EventsBanner.webp',
    coverAlt: 'A catered spread from Mama Yoli',
    categories: ['food', 'services'],
    city: 'Delray Beach',
    county: 'palm_beach',
    coords: { lat: 26.4615, lng: -80.0728 },
    onlineOnly: false,
    certified: true,
    claimed: false,
    savedCount: 64,
    recommendedCount: 29,
    recommenderAvatars: ['/img/about/bee_maria.jpg'],
    nextEvent: null,
    lastUpdateDays: null,
    blurb:
      'Griot, pikliz, and rice that people ask about for weeks afterward. Books up a month out.',
  },
  {
    id: 'biz-10',
    slug: 'coral-collective',
    name: 'Coral Collective',
    tagline: 'Shared studio and darkroom',
    logo: '/img/impact/zine-series.webp',
    coverImage: '/img/impact/heatwave-visions.webp',
    coverAlt: 'Members working in the Coral Collective studio',
    categories: ['art', 'Venue', 'services'],
    city: 'West Palm Beach',
    county: 'palm_beach',
    coords: { lat: 26.7153, lng: -80.0534 },
    onlineOnly: false,
    certified: false,
    claimed: true,
    savedCount: 141,
    recommendedCount: 47,
    recommenderAvatars: [
      '/img/about/claribel_avila.jpg',
      '/img/about/anette_mago.jpg',
    ],
    nextEvent: { title: 'Darkroom 101', inDays: 21 },
    lastUpdateDays: 12,
    blurb:
      'Day passes, monthly benches, and the last public darkroom north of Broward.',
  },
];

export type SortKey = 'relevance' | 'nearest' | 'recommended' | 'active';

export const SORT_OPTIONS: { key: SortKey; label: string; hint: string }[] = [
  {
    key: 'relevance',
    label: 'Best match',
    hint: 'How well it matches your search',
  },
  { key: 'nearest', label: 'Nearest', hint: 'Closest to you first' },
  {
    key: 'recommended',
    label: 'Most recommended',
    hint: 'Vouched for by the most panas',
  },
  {
    key: 'active',
    label: 'Recently active',
    hint: 'Posted on Pana Social most recently',
  },
];

/**
 * Score a listing against the typed term.
 *
 * Crude on purpose — the real ranking lives in Postgres. What matters for the
 * mock is that the ordering is *explicable*: a name match beats a city match
 * beats a category match, so "Best match" visibly differs from "Nearest" and
 * the sort control has something to demonstrate.
 */
export function matchScore(result: DirectoryResult, term: string): number {
  const q = term.trim().toLowerCase();
  if (!q) return 1;

  const name = result.name.toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;

  if (result.tagline.toLowerCase().includes(q)) return 40;
  if (result.city.toLowerCase().includes(q)) return 30;

  const categoryHit = result.categories.some((c) =>
    (CATEGORY_LABEL[c] ?? c).toLowerCase().includes(q)
  );
  if (categoryHit) return 25;

  if (result.blurb.toLowerCase().includes(q)) return 20;

  return 0;
}

export interface QueryState {
  term: string;
  categories: string[];
  counties: string[];
  certifiedOnly: boolean;
  openToEvents: boolean;
  sort: SortKey;
}

export interface ScoredResult {
  result: DirectoryResult;
  score: number;
  /** Null when the viewer shared no location, or the business is online-only. */
  distance: number | null;
}

/**
 * Apply the whole query to the fixture.
 *
 * Kept as one pure function rather than a chain inside the component so the
 * mock's filtering is testable by reading it, and so "why is this result here"
 * has a single place to look.
 */
export function runQuery(
  query: QueryState,
  viewerCoords: Coords | null
): ScoredResult[] {
  const scored = directoryResults
    .map((result) => ({
      result,
      score: matchScore(result, query.term),
      distance:
        viewerCoords && result.coords
          ? distanceInMiles(viewerCoords, result.coords)
          : null,
    }))
    .filter(({ result, score }) => {
      if (score === 0) return false;
      if (
        query.categories.length > 0 &&
        !result.categories.some((c) => query.categories.includes(c))
      ) {
        return false;
      }
      if (
        query.counties.length > 0 &&
        !query.counties.includes(result.county)
      ) {
        return false;
      }
      if (query.certifiedOnly && !result.certified) return false;
      if (query.openToEvents && !result.nextEvent) return false;
      return true;
    });

  const byName = (a: ScoredResult, b: ScoredResult) =>
    a.result.name.localeCompare(b.result.name);

  switch (query.sort) {
    case 'nearest':
      return scored.sort((a, b) => {
        // An online-only business has no distance, so it cannot be ranked by
        // one. Sinking them to the bottom is the honest option: the viewer
        // asked for near, and "near" is a question this listing cannot answer.
        if (a.distance === null && b.distance === null) return byName(a, b);
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    case 'recommended':
      return scored.sort(
        (a, b) => b.result.recommendedCount - a.result.recommendedCount
      );
    case 'active':
      return scored.sort((a, b) => {
        const aDays = a.result.lastUpdateDays;
        const bDays = b.result.lastUpdateDays;
        if (aDays === null && bDays === null) return byName(a, b);
        if (aDays === null) return 1;
        if (bDays === null) return -1;
        return aDays - bDays;
      });
    default:
      return scored.sort((a, b) => b.score - a.score || byName(a, b));
  }
}

/** Shorthand for a date a card only needs to place roughly. */
export function formatInDays(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  if (days < 14) return 'next week';
  if (days < 31) return `in ${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30);
  return `in ${months} month${months === 1 ? '' : 's'}`;
}

export function formatLastActive(days: number | null): string | null {
  if (days === null) return null;
  if (days <= 1) return 'Active today';
  if (days < 7) return `Active ${days}d ago`;
  if (days < 30) return `Active ${Math.floor(days / 7)}w ago`;
  return `Active ${Math.floor(days / 30)}mo ago`;
}
