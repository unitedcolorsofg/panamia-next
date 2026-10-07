import type { CategoryInterface, CountyInterface } from '@/lib/interfaces';

/**
 * Fixture data for the admin surface.
 *
 * Nothing here touches the database. Every row is shaped to match the real
 * `profiles` table in `lib/schema/index.ts` so that swapping this module for a
 * query is a mechanical change rather than a rewrite — same keys, same types,
 * same meaning of `null`.
 *
 * Dates are expressed relative to `now()` rather than hard-coded, so the queue
 * never rots into "submitted 3 years ago" the way a fixed timestamp would.
 */

export type CategoryKey = keyof CategoryInterface;
export type CountyKey = keyof CountyInterface;

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  products: 'Products',
  services: 'Services',
  events: 'Events',
  music: 'Music',
  food: 'Food',
  clothing: 'Clothing',
  accessories: 'Accessories',
  art: 'Art',
  digital_art: 'Digital art',
  tech: 'Tech',
  health_beauty: 'Health & beauty',
  wellness: 'Wellness',
  non_profit: 'Non-profit',
  homemade: 'Homemade',
};

export const COUNTY_LABEL: Record<CountyKey, string> = {
  miami_dade: 'Miami-Dade',
  broward: 'Broward',
  palm_beach: 'Palm Beach',
};

/**
 * Why a listing needs a person rather than a rule.
 *
 * The queue's job is not to list names — it is to say what is wrong with each
 * one, so a reviewer can spend their attention on the four that are genuinely
 * ambiguous instead of re-reading the ten that are fine. These are the five
 * reasons a Pana Mia listing actually gets held up today.
 */
export type ReviewFlag =
  | 'no-socials'
  | 'possible-duplicate'
  | 'outside-area'
  | 'thin-details'
  | 'national-brand';

export const FLAG_LABEL: Record<ReviewFlag, string> = {
  'no-socials': 'No socials to verify',
  'possible-duplicate': 'Possible duplicate',
  'outside-area': 'Outside South Florida',
  'thin-details': 'Thin details',
  'national-brand': 'Looks like a chain',
};

export const FLAG_NOTE: Record<ReviewFlag, string> = {
  'no-socials': 'No Instagram or site on the application, so there is nothing to check the listing against.',
  'possible-duplicate': 'A live listing already uses a name this close. One of them is probably a re-submission.',
  'outside-area': 'Service area falls outside the three counties the directory covers.',
  'thin-details': 'Description is too short to tell a visitor what they actually do.',
  'national-brand': 'Reads like a franchise or a reseller rather than an independent Pana.',
};

/**
 * A listing waiting on a decision.
 *
 * Mirrors the real row: `active` is the published flag and defaults false,
 * `status` is the jsonb blob the approve/decline endpoint stamps, and
 * `claimedBy` is the personal address asking to own the listing — which is
 * frequently *not* the business address on the form, and is the single most
 * common reason a reviewer pauses.
 */
export interface PendingListing {
  id: string;
  name: string;
  slug: string;
  /** The contact on the listing itself. */
  email: string;
  /** `profiles.createdAt`. */
  submittedAt: Date;
  /** `profiles.active`. Always false while pending — this is what approval flips. */
  active: false;
  /** `profiles.status` jsonb: `{ access, approved?, declined? }`. */
  status: { access: string; approved?: string; declined?: string };
  categories: CategoryKey[];
  counties: CountyKey[];
  locality: string;
  details: string;
  instagram: string | null;
  website: string | null;
  /** Personal address requesting ownership. `null` when nobody has claimed it. */
  claimedBy: string | null;
  flags: ReviewFlag[];
}

export interface DecidedListing {
  id: string;
  name: string;
  locality: string;
  decidedAt: Date;
  decision: 'approved' | 'declined';
  /** Who pressed the button. Real rows do not record this yet — see the page. */
  decidedBy: string;
  /** Only set on declines. */
  reason?: string;
}

function daysAgo(days: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * Fourteen applications, the oldest sitting for a month.
 *
 * The spread is deliberately unflattering, for the same reason the connectors
 * dashboard shows 15 of 26 members unhoused: a queue screen that renders an
 * empty, tidy list proves nothing. The backlog *is* the argument for building
 * the screen, because today an admin can only act on an application they still
 * have the email for.
 */
export const PENDING_LISTINGS: PendingListing[] = [
  {
    id: 'lst-dulce',
    name: 'Dulce Vida Panadería',
    slug: 'dulce-vida-panaderia',
    email: 'hola@dulcevidapan.com',
    submittedAt: daysAgo(31),
    active: false,
    status: { access: 'a7f3c1' },
    categories: ['food', 'homemade'],
    counties: ['miami_dade'],
    locality: 'Hialeah',
    details:
      'Third-generation Cuban bakery. Pastelitos, pan de agua and birthday cakes to order, open since the shop on Palm Ave closed.',
    instagram: 'dulcevidapan',
    website: null,
    claimedBy: 'marisol.perez88@gmail.com',
    flags: [],
  },
  {
    id: 'lst-reef',
    name: 'Reef & Thread',
    slug: 'reef-thread',
    email: 'studio@reefandthread.co',
    submittedAt: daysAgo(27),
    active: false,
    status: { access: 'b21d99' },
    categories: ['clothing', 'art'],
    counties: ['broward'],
    locality: 'Fort Lauderdale',
    details: 'Hand-dyed swimwear.',
    instagram: null,
    website: null,
    claimedBy: null,
    flags: ['no-socials', 'thin-details'],
  },
  {
    id: 'lst-calle',
    name: 'Calle Ocho Coffee Roasters',
    slug: 'calle-ocho-coffee-roasters',
    email: 'info@calleochoroast.com',
    submittedAt: daysAgo(24),
    active: false,
    status: { access: 'c0e4b2' },
    categories: ['food', 'products'],
    counties: ['miami_dade'],
    locality: 'Little Havana',
    details:
      'Small-batch roaster on SW 8th. Single-origin Colombian and a house cafecito blend, wholesale to six local cafés.',
    instagram: 'calleochoroast',
    website: 'calleochoroast.com',
    claimedBy: 'jorge@calleochoroast.com',
    flags: ['possible-duplicate'],
  },
  {
    id: 'lst-mangrove',
    name: 'Mangrove Mental Health Collective',
    slug: 'mangrove-mental-health-collective',
    email: 'care@mangrovecollective.org',
    submittedAt: daysAgo(19),
    active: false,
    status: { access: 'd5a710' },
    categories: ['wellness', 'health_beauty', 'non_profit'],
    counties: ['miami_dade', 'broward'],
    locality: 'North Miami',
    details:
      'Sliding-scale therapy collective. Six licensed clinicians, Spanish and Kreyòl, no one turned away for cost.',
    instagram: 'mangrovecollective',
    website: 'mangrovecollective.org',
    claimedBy: 'dr.anaya@mangrovecollective.org',
    flags: [],
  },
  {
    id: 'lst-sunbeam',
    name: 'Sunbeam Print Shop',
    slug: 'sunbeam-print-shop',
    email: 'orders@sunbeamprint.com',
    submittedAt: daysAgo(16),
    active: false,
    status: { access: 'e9c388' },
    categories: ['services', 'art'],
    counties: ['palm_beach'],
    locality: 'Lake Worth Beach',
    details:
      'Risograph and screen printing for artists and small runs. Two-colour posters, zines, show flyers.',
    instagram: 'sunbeamprintshop',
    website: null,
    claimedBy: 'k.waters.design@gmail.com',
    flags: [],
  },
  {
    id: 'lst-vera',
    name: 'Vera Nails & Spa',
    slug: 'vera-nails-spa',
    email: 'veranailsspa@outlook.com',
    submittedAt: daysAgo(14),
    active: false,
    status: { access: 'f2b541' },
    categories: ['health_beauty', 'services'],
    counties: ['broward'],
    locality: 'Pembroke Pines',
    details: 'Nail salon.',
    instagram: null,
    website: null,
    claimedBy: null,
    flags: ['thin-details', 'no-socials'],
  },
  {
    id: 'lst-tropic',
    name: 'Tropic Supply Co.',
    slug: 'tropic-supply-co',
    email: 'wholesale@tropicsupply.com',
    submittedAt: daysAgo(12),
    active: false,
    status: { access: 'a4d6e0' },
    categories: ['products', 'accessories'],
    counties: ['miami_dade', 'broward', 'palm_beach'],
    locality: 'Doral',
    details:
      'Distributor for beach and pool accessories. Authorised reseller for several national outdoor brands.',
    instagram: 'tropicsupplyco',
    website: 'tropicsupply.com',
    claimedBy: 'sales@tropicsupply.com',
    flags: ['national-brand'],
  },
  {
    id: 'lst-azucar',
    name: 'Azúcar Negra Records',
    slug: 'azucar-negra-records',
    email: 'bookings@azucarnegra.fm',
    submittedAt: daysAgo(11),
    active: false,
    status: { access: 'b8f271' },
    categories: ['music', 'events'],
    counties: ['miami_dade'],
    locality: 'Allapattah',
    details:
      'Independent label and rehearsal space. Afro-Cuban and experimental, monthly showcase in the warehouse.',
    instagram: 'azucarnegrafm',
    website: 'azucarnegra.fm',
    claimedBy: 'yami@azucarnegra.fm',
    flags: [],
  },
  {
    id: 'lst-palmetto',
    name: 'Palmetto Bay Yoga',
    slug: 'palmetto-bay-yoga',
    email: 'hello@palmettobayyoga.com',
    submittedAt: daysAgo(9),
    active: false,
    status: { access: 'c3a905' },
    categories: ['wellness'],
    counties: ['miami_dade'],
    locality: 'Palmetto Bay',
    details:
      'Neighbourhood studio. Vinyasa, prenatal and a free community class on Sunday mornings in the park.',
    instagram: 'palmettobayyoga',
    website: 'palmettobayyoga.com',
    claimedBy: 'sierra.l@gmail.com',
    flags: ['possible-duplicate'],
  },
  {
    id: 'lst-orlando',
    name: 'Lakeside Ceramics Studio',
    slug: 'lakeside-ceramics-studio',
    email: 'studio@lakesideceramics.com',
    submittedAt: daysAgo(8),
    active: false,
    status: { access: 'd7e1c4' },
    categories: ['art', 'homemade'],
    counties: [],
    locality: 'Winter Park',
    details:
      'Wheel-throwing classes and a members-only kiln. Six wheels, open studio hours Thursday through Sunday.',
    instagram: 'lakesideceramics',
    website: null,
    claimedBy: 'tom@lakesideceramics.com',
    flags: ['outside-area'],
  },
  {
    id: 'lst-bonita',
    name: 'Bonita Flores',
    slug: 'bonita-flores',
    email: 'pedidos@bonitaflores.shop',
    submittedAt: daysAgo(6),
    active: false,
    status: { access: 'e1b847' },
    categories: ['products', 'homemade', 'events'],
    counties: ['miami_dade'],
    locality: 'Westchester',
    details:
      'Floral design out of a home studio. Weddings, quinces and standing arrangements for three local restaurants.',
    instagram: 'bonitaflores.mia',
    website: null,
    claimedBy: 'bonita.flores.mia@gmail.com',
    flags: [],
  },
  {
    id: 'lst-codehaus',
    name: 'Codehaus Collective',
    slug: 'codehaus-collective',
    email: 'team@codehaus.dev',
    submittedAt: daysAgo(4),
    active: false,
    status: { access: 'f6c230' },
    categories: ['tech', 'services', 'digital_art'],
    counties: ['broward'],
    locality: 'Hollywood',
    details:
      'Worker-owned dev shop. Websites and booking systems for small businesses, sliding scale for non-profits.',
    instagram: 'codehaus.dev',
    website: 'codehaus.dev',
    claimedBy: 'ren@codehaus.dev',
    flags: [],
  },
  {
    id: 'lst-mamey',
    name: 'Mamey Juice Bar',
    slug: 'mamey-juice-bar',
    email: 'hi@mameyjuice.com',
    submittedAt: daysAgo(2),
    active: false,
    status: { access: 'a9d514' },
    categories: ['food'],
    counties: ['miami_dade'],
    locality: 'Coconut Grove',
    details:
      'Cold-pressed juice and batidos from a window on Grand Ave. Fruit sourced from growers in Homestead.',
    instagram: 'mameyjuicebar',
    website: null,
    claimedBy: null,
    flags: [],
  },
  {
    id: 'lst-sawgrass',
    name: 'Sawgrass Woodworks',
    slug: 'sawgrass-woodworks',
    email: 'build@sawgrasswood.com',
    submittedAt: daysAgo(1, 16),
    active: false,
    status: { access: 'b4e706' },
    categories: ['homemade', 'products', 'services'],
    counties: ['broward', 'palm_beach'],
    locality: 'Davie',
    details:
      'Reclaimed-wood furniture and built-ins. Mostly salvage from houses coming down along the New River.',
    instagram: 'sawgrasswood',
    website: 'sawgrasswood.com',
    claimedBy: 'd.ruiz@sawgrasswood.com',
    flags: [],
  },
];

/** The other half of the story: what has actually been decided lately. */
export const RECENT_DECISIONS: DecidedListing[] = [
  {
    id: 'dec-1',
    name: 'Güiro & Clave',
    locality: 'Wynwood',
    decidedAt: daysAgo(1, 14),
    decision: 'approved',
    decidedBy: 'nicole@panamia.club',
  },
  {
    id: 'dec-2',
    name: 'SunPower Solar Deals',
    locality: 'Miami Gardens',
    decidedAt: daysAgo(3, 11),
    decision: 'declined',
    decidedBy: 'nicole@panamia.club',
    reason: 'Reseller for a national brand, not an independent business.',
  },
  {
    id: 'dec-3',
    name: 'Casita Verde Plants',
    locality: 'El Portal',
    decidedAt: daysAgo(5, 9),
    decision: 'approved',
    decidedBy: 'jess@panamia.club',
  },
  {
    id: 'dec-4',
    name: 'Blue Line Logistics LLC',
    locality: 'Medley',
    decidedAt: daysAgo(6, 15),
    decision: 'declined',
    decidedBy: 'nicole@panamia.club',
    reason: 'B2B freight. Nothing a directory visitor can walk into or buy.',
  },
  {
    id: 'dec-5',
    name: 'Taller Tipográfico',
    locality: 'Little Haiti',
    decidedAt: daysAgo(8, 12),
    decision: 'approved',
    decidedBy: 'jess@panamia.club',
  },
];

// ---------------------------------------------------------------------------

export function daysWaiting(submittedAt: Date): number {
  const start = new Date(submittedAt);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - start.getTime()) / 86_400_000);
}

/** How long something has sat, in the words a reviewer would use. */
export function waitLabel(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/**
 * The service level the queue is measured against.
 *
 * Fourteen days is not a policy that exists yet — it is a proposal this screen
 * makes concrete. Pick a number, and the backlog stops being a vague worry and
 * becomes a count you can read off the top of the page.
 */
export const REVIEW_SLA_DAYS = 14;

export interface ListingStat {
  label: string;
  value: string;
  note: string;
}

export function listingStats(rows: readonly PendingListing[]): ListingStat[] {
  const waits = rows.map((r) => daysWaiting(r.submittedAt)).sort((a, b) => a - b);
  const overdue = waits.filter((d) => d > REVIEW_SLA_DAYS).length;
  const median = waits.length
    ? waits.length % 2
      ? waits[(waits.length - 1) / 2]
      : Math.round((waits[waits.length / 2 - 1] + waits[waits.length / 2]) / 2)
    : 0;
  const unclaimed = rows.filter((r) => !r.claimedBy).length;
  const flagged = rows.filter((r) => r.flags.length > 0).length;

  return [
    { label: 'Waiting', value: String(rows.length), note: 'applications with no decision' },
    {
      label: `Over ${REVIEW_SLA_DAYS} days`,
      value: String(overdue),
      note: 'past the review window',
    },
    { label: 'Median wait', value: waitLabel(median), note: 'half have waited longer' },
    { label: 'Oldest', value: waitLabel(waits[waits.length - 1] ?? 0), note: 'still untouched' },
    { label: 'Need a look', value: String(flagged), note: `${unclaimed} also unclaimed` },
  ];
}

/** Oldest first. A queue sorted any other way is a list, not a queue. */
export function queueOrder(rows: readonly PendingListing[]): PendingListing[] {
  return [...rows].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
}
