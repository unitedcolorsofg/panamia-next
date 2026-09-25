import type { SuggestionKind } from '@/lib/suggest';

/**
 * Fixtures for /mock/directory-unified.
 *
 * The whole argument of this mock is in the shape of this type, so it is worth
 * reading before the components.
 *
 * Today the directory has two result types that share almost nothing. A
 * business is an `article` with a cover, a logo, a certification badge, city
 * and distance, a blurb, category pills, a next-event strip, recommend and
 * save counts, and three actions. A pana, group or event is a 48px thumbnail
 * with a name, a subtitle and one line of meta. They do not merely look
 * different — they answer different questions, and which one you get depends
 * on a scope chip rather than on anything about the thing itself.
 *
 * The claim here is that this was never a real difference. It is a difference
 * in how much work we did per kind. Every kind has an image, a name, a
 * one-line identity, a place, a moment in time, a body of text, some tags, a
 * community signal and something to do next — the nouns change, the slots do
 * not:
 *
 *                business        pana            group           event
 *   tagline      five words      headline        purpose         —
 *   where        city + miles    city            online/city     venue + city
 *   when         next event      —               next meetup     starts at
 *   pills        categories      interests       tags            tags
 *   signal       12 recommend    40 panas follow 88 members      23 going
 *   action       Save / Follow   Follow          Join            RSVP
 *
 * So the card takes one shape and lets each kind fill it. A row with no data
 * does not render, which is what already makes the business card vary between
 * a claimed and an unclaimed listing — this extends that rule across kinds
 * instead of forking the component.
 *
 * `certified` and `distance` stay business-only on purpose. Pana Certified is
 * a statement about a business's standing in the directory and means nothing
 * on an event; distance is measured from a listing's address and most panas
 * do not publish one. A slot no kind can honestly fill is not worth unifying.
 */
export interface UnifiedResult {
  id: string;
  kind: SuggestionKind;
  name: string;
  href: string;
  /** Cover art. Every kind has one; the card falls back to a tinted panel. */
  cover: string | null;
  /** Avatar or logo, laid over the cover. Null for events, which have no face. */
  badge: string | null;
  /** One line of identity, directly under the name. */
  tagline: string | null;
  /** Where this is. Already a formatted string — the mock does not geocode. */
  where: string | null;
  /** Distance from the viewer. Business-only; see the header. */
  distance: string | null;
  /** A moment worth acting on: a next event, a next meetup, a start time. */
  when: string | null;
  /** Prose. Two lines, clamped. */
  blurb: string | null;
  /** Categories, interests or tags — the same pill row either way. */
  pills: string[];
  /** The community number this kind is measured by, already in words. */
  signal: string | null;
  /** Faces behind the signal. Empty renders nothing. */
  faces: string[];
  /** The write action this kind offers, or null when there is nothing to do. */
  action: 'save' | 'follow' | 'join' | 'rsvp' | null;
  certified: boolean;
}

const FACES = [
  '/img/about/anette_mago.jpg',
  '/img/about/bee_maria.jpg',
  '/img/about/claribel_avila.jpg',
  '/img/about/gbarrios.jpg',
];

export const UNIFIED_RESULTS: UnifiedResult[] = [
  {
    id: 'b1',
    kind: 'business',
    name: 'El Fogon Food Truck',
    href: '/p/el-fogon',
    cover: '/img/impact/hero-mixer.webp',
    badge: '/img/impact/partner-dale.webp',
    tagline: 'Arepas and slow-cooked pernil',
    where: 'Coral Springs',
    distance: '2.4 mi',
    when: 'Tonight at Green Market',
    blurb:
      'We started out of a home kitchen selling to neighbours, and we still cook the same way — one pot at a time, mostly on weekends.',
    pills: ['Food', 'Products'],
    signal: '12 recommend',
    faces: FACES.slice(0, 4),
    action: 'save',
    certified: true,
  },
  {
    id: 'b2',
    kind: 'business',
    name: 'Barrio Arts Lab',
    href: '/p/barrio-arts-lab',
    cover: '/img/impact/culture-zines-left.webp',
    badge: null,
    tagline: 'A working studio and gallery',
    where: 'Delray Beach',
    distance: '11 mi',
    when: null,
    blurb:
      'Open studio Thursdays. Screenprinting, risograph and a wall that belongs to whoever books it first.',
    pills: ['Services', 'Venues'],
    signal: '6 recommend',
    faces: FACES.slice(0, 2),
    action: 'save',
    certified: false,
  },
  {
    id: 'p1',
    kind: 'pana',
    name: 'Maria Restrepo',
    href: '/p/maria-restrepo',
    cover: '/img/about/bubbles_navy.jpg',
    badge: '/img/about/bee_maria.jpg',
    tagline: 'Ceramicist, teaches Tuesdays',
    where: 'Little Haiti',
    distance: null,
    when: null,
    blurb:
      'Hand-built tableware and a small wheel-throwing class out of a shared studio off NE 2nd.',
    pills: ['Ceramics', 'Teaching'],
    signal: '40 panas follow',
    faces: FACES.slice(1, 4),
    action: 'follow',
    certified: false,
  },
  {
    id: 'g1',
    kind: 'group',
    name: 'South Florida Zine Club',
    href: '/g/sofl-zine-club',
    cover: '/img/impact/culture-zines-right.webp',
    badge: null,
    tagline: 'Monthly swaps and a shared risograph',
    where: 'Meets in Broward',
    distance: null,
    when: 'Next meetup Sat 14 Feb',
    blurb:
      'Bring five copies of anything you made. We trade, we read, nobody critiques unless you ask.',
    pills: ['Zines', 'Print', 'Open to all'],
    signal: '88 members',
    faces: FACES.slice(0, 3),
    action: 'join',
    certified: false,
  },
  {
    id: 'e1',
    kind: 'event',
    name: 'Heatwave Visions: Opening Night',
    href: '/events/heatwave-visions',
    cover: '/img/impact/heatwave-visions.webp',
    badge: null,
    tagline: null,
    where: 'Bakehouse Art Complex · Wynwood',
    distance: null,
    when: 'Fri 20 Feb, 7:00 PM',
    blurb:
      'Twelve South Florida artists on heat, water and the year the summer did not end. Free, cash bar.',
    pills: ['Art', 'Free'],
    signal: '23 going',
    faces: FACES.slice(2, 4),
    action: 'rsvp',
    certified: false,
  },
];

/** Counts shown on the scope chips. Invented, and consistent with the list. */
export const UNIFIED_COUNTS: Record<SuggestionKind, number> = {
  business: 17,
  pana: 6,
  group: 3,
  event: 4,
};

export const ACTION_LABEL: Record<
  NonNullable<UnifiedResult['action']>,
  string
> = {
  save: 'Save',
  follow: 'Follow',
  join: 'Join',
  rsvp: 'RSVP',
};
