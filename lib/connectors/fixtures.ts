/**
 * Fixture data for the Connectors mock.
 *
 * Everything here stands in for tables that do not exist yet. It is shaped
 * exactly like the real thing will be — same field names, same nullability,
 * same awkward cases — so that swapping in `lib/query/connectors.ts` later is
 * a change of data source and not a rewrite of every component.
 *
 * Two deliberate choices:
 *
 * 1. **Dates are relative to now**, never hardcoded. A mock with fixed dates
 *    looks dead within a fortnight — "Upcoming events" full of last month is
 *    worse than no mock at all. Everything here is computed off `now()` so the
 *    dashboard is always plausibly live whenever somebody opens it.
 *
 * 2. **The roster is mostly unassigned.** Fifteen of the twenty-six connectors
 *    have no house. That is not laziness in the fixture; it is the real state
 *    of the sheet, and it is the single most useful thing the admin view can
 *    surface. A tidy fixture where everyone is neatly sorted would hide the
 *    one problem the page exists to solve.
 *
 * The content — names, events, commitments — is lifted from the Connector
 * Dashboard sheet so the panas recognise their own programme when they open
 * it, rather than reviewing a page of lorem ipsum.
 */

import {
  type Ask,
  type Commitment,
  type Connector,
  type ConnectorEvent,
  type HouseId,
  HOUSES,
  PODS,
  type PodId,
} from './model';

/**
 * Midnight today, so every derived date lands on a stable day boundary no
 * matter what time the page is rendered. Without this, "in 3 days" flips to
 * "in 2 days" partway through an afternoon and two components disagree.
 */
function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function inDays(days: number, hour = 18, minute = 0): Date {
  const d = today();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** `MM-DD` for a date N days out — used to place birthdays in the near future. */
function birthdayInDays(days: number): string {
  const d = inDays(days);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CONNECTORS: readonly Connector[] = [
  // Miami pod — the oldest and largest, which is why most of the named
  // commitments below belong to people in it.
  { id: 'clari', name: 'Claribel Avila', podId: 'miami', houseId: 'relationshipBuilding', tier: 3, birthday: birthdayInDays(7) },
  { id: 'isa', name: 'Isa Marrero', podId: 'miami', houseId: 'relationshipBuilding', tier: 3, birthday: birthdayInDays(52) },
  { id: 'jeremy', name: 'Jeremy Downs', podId: 'miami', houseId: 'relationshipBuilding', tier: 2, birthday: null },
  { id: 'bianca', name: 'Bianca Restrepo', podId: 'miami', houseId: 'culturalWorkers', tier: 1, birthday: birthdayInDays(19) },
  { id: 'river', name: 'River Okonkwo', podId: 'miami', houseId: 'education', tier: 3, birthday: null },
  { id: 'strawberri', name: 'Strawberri Melendez', podId: 'miami', houseId: 'narrativeShifters', tier: 3, birthday: birthdayInDays(104) },
  { id: 'juno', name: 'Juno Quintana', podId: 'miami', houseId: null, tier: 1, birthday: birthdayInDays(33) },
  { id: 'aitana', name: 'Aitana Hidalgo', podId: 'miami', houseId: null, tier: 1, birthday: birthdayInDays(66) },
  { id: 'marisol', name: 'Marisol Peña', podId: 'miami', houseId: null, tier: 1, birthday: null },
  { id: 'dee', name: 'Dee Saint-Fleur', podId: 'miami', houseId: null, tier: 1, birthday: null },
  { id: 'omar', name: 'Omar Benítez', podId: 'miami', houseId: null, tier: 1, birthday: null },
  { id: 'yaz', name: 'Yaz Villalobos', podId: 'miami', houseId: null, tier: 1, birthday: null },
  { id: 'tali', name: 'Tali Rosen', podId: 'miami', houseId: null, tier: 1, birthday: null },
  { id: 'kiki', name: 'Kiki Laurent', podId: 'miami', houseId: null, tier: 1, birthday: null },
  { id: 'nando', name: 'Nando Cruz', podId: 'miami', houseId: null, tier: 1, birthday: null },

  // Palm Beach pod
  { id: 'jaime', name: 'Jaime Ballester', podId: 'palmBeach', houseId: 'relationshipBuilding', tier: 2, birthday: birthdayInDays(12) },
  { id: 'thailur', name: 'Thailur Jean', podId: 'palmBeach', houseId: 'education', tier: 2, birthday: null },
  { id: 'anette', name: 'Anette Prieto', podId: 'palmBeach', houseId: 'culturalWorkers', tier: 2, birthday: null },
  { id: 'sol', name: 'Sol Arismendi', podId: 'palmBeach', houseId: null, tier: 1, birthday: null },
  { id: 'wren', name: 'Wren Delacroix', podId: 'palmBeach', houseId: null, tier: 1, birthday: null },
  { id: 'pilar', name: 'Pilar Ocampo', podId: 'palmBeach', houseId: null, tier: 1, birthday: null },

  // Broward pod — newest, so everybody is still Tier 1 and unhoused.
  { id: 'deshawn', name: 'DeShawn Miles', podId: 'broward', houseId: 'narrativeShifters', tier: 1, birthday: null },
  { id: 'luz', name: 'Luz Caraballo', podId: 'broward', houseId: 'education', tier: 1, birthday: null },
  { id: 'ori', name: 'Ori Bensimon', podId: 'broward', houseId: null, tier: 1, birthday: null },
  { id: 'camila', name: 'Camila Duarte', podId: 'broward', houseId: null, tier: 1, birthday: null },
  { id: 'theo', name: 'Theo Nascimento', podId: 'broward', houseId: null, tier: 1, birthday: null },
];

export const EVENTS: readonly ConnectorEvent[] = [
  {
    id: 'miccosukee-symposium',
    title: 'Miccosukee Symposium',
    cadence: 'oneTime',
    when: 'Doors at 10a',
    startsAt: inDays(3, 10),
    where: 'FIU Modesto A. Maidique Campus',
    lead: 'Pana MIA',
    volunteersNeeded: 4,
    volunteersFilled: 2,
    tasks: ['Event volunteer', 'Tabling'],
    contactName: 'Isa Marrero',
    contactPhone: null,
    href: null,
  },
  {
    id: 'join-or-die',
    title: 'Join or Die — screening + talkback',
    cadence: 'oneTime',
    when: 'Doors at 6:30p',
    startsAt: inDays(5, 18, 30),
    where: 'O Cinema South Beach',
    lead: 'Pana MIA',
    volunteersNeeded: 2,
    volunteersFilled: 2,
    tasks: ['Tabling'],
    contactName: 'Claribel Avila',
    contactPhone: null,
    href: null,
  },
  {
    id: 'pana-social-food-futures',
    title: 'Pana Social: Miami Food Futures',
    cadence: 'oneTime',
    when: '4:40–8:30p',
    startsAt: inDays(9, 16, 40),
    where: 'Vizcaya Museum and Gardens',
    lead: 'Pana MIA',
    volunteersNeeded: 8,
    volunteersFilled: 3,
    tasks: ['Tabling (2 people)', 'General PAs (4 people)', 'Media (2 people)'],
    contactName: 'Isa Marrero',
    contactPhone: '(786) 554-9686',
    href: '/events',
  },
  {
    id: 'zine-folding-night',
    title: 'Zine Folding Night',
    cadence: 'oneTime',
    when: '7p until we run out of staples',
    startsAt: inDays(14, 19),
    where: 'AC Club, West Palm Beach',
    lead: 'Pana MIA',
    // "no cap!" in the sheet. Rendered as an open door, not as zero.
    volunteersNeeded: null,
    volunteersFilled: 6,
    tasks: ['Folding zines'],
    contactName: 'Anette Prieto',
    contactPhone: '(954) 512-7292',
    href: null,
  },
  {
    id: 'bryant-park-food-share',
    title: 'Food Share',
    cadence: 'weekly',
    when: 'Thursdays @ 5p',
    startsAt: inDays(2, 17),
    where: 'Bryant Park, north side',
    lead: 'DSA',
    volunteersNeeded: 5,
    volunteersFilled: 4,
    tasks: ['Serving', 'Breakdown'],
    contactName: 'Thailur Jean',
    contactPhone: null,
    href: null,
  },
  {
    id: 'weekend-food-share-outreach',
    title: 'Food Share & Outreach',
    cadence: 'weekends',
    when: 'Saturdays 4:30p · Sundays 11:30a',
    startsAt: inDays(4, 16, 30),
    where: '401 N Clematis St · José Martí Park',
    lead: 'General Strike US',
    volunteersNeeded: null,
    volunteersFilled: 9,
    tasks: ['Food Not Bombs', 'Mutual aid distro'],
    contactName: 'Jaime Ballester',
    contactPhone: '(787) 459-0022',
    href: null,
  },
];

export const COMMITMENTS: readonly Commitment[] = [
  {
    id: 'c1',
    connectorId: 'jeremy',
    what: 'Make connections for the election results watch party',
    when: 'Through November',
    houseIds: ['relationshipBuilding'],
    tier: 2,
    progress: 'inProgress',
  },
  {
    id: 'c2',
    connectorId: 'jeremy',
    what: 'Secure a venue for the watch party',
    when: null,
    houseIds: ['relationshipBuilding'],
    tier: null,
    progress: 'notSet',
  },
  {
    id: 'c3',
    connectorId: 'strawberri',
    what: 'Connect with Aurora, PowerU and MWC, set up a collective for parents and children, and host a first event',
    when: 'Late October — early November',
    houseIds: ['narrativeShifters', 'relationshipBuilding'],
    tier: 3,
    progress: 'inProgress',
  },
  {
    id: 'c4',
    connectorId: 'strawberri',
    what: 'Pull together the story of the first six months of pods',
    when: 'December',
    houseIds: ['narrativeShifters'],
    tier: 3,
    progress: 'notSet',
  },
  {
    id: 'c5',
    connectorId: 'clari',
    what: 'Election results viewing party — Miami',
    when: 'Late October — early November',
    houseIds: ['relationshipBuilding', 'narrativeShifters'],
    tier: 3,
    progress: 'inProgress',
  },
  {
    id: 'c6',
    connectorId: 'clari',
    what: 'Onboard the connectors who have not picked a house yet',
    when: 'This month',
    houseIds: ['relationshipBuilding'],
    tier: 3,
    progress: 'inProgress',
  },
  {
    id: 'c7',
    connectorId: 'river',
    what: 'Grant calendar',
    when: 'This month',
    houseIds: ['education'],
    tier: 3,
    progress: 'done',
  },
  {
    id: 'c8',
    connectorId: 'river',
    what: 'Grant base form',
    when: 'This month',
    houseIds: ['education'],
    tier: 3,
    progress: 'notSet',
  },
  {
    id: 'c9',
    connectorId: 'river',
    what: 'Water usage research for the next PITbook',
    when: 'Before the new year',
    houseIds: ['education'],
    tier: 3,
    progress: 'notSet',
  },
  {
    id: 'c10',
    connectorId: 'bianca',
    what: 'Distributing zines across Little Haiti and Buena Vista',
    when: 'This month',
    houseIds: ['education'],
    tier: 1,
    progress: 'inProgress',
  },
  {
    id: 'c11',
    connectorId: 'bianca',
    what: 'Help with art builds',
    when: null,
    houseIds: ['culturalWorkers'],
    tier: 1,
    progress: 'notSet',
  },
  {
    id: 'c12',
    connectorId: 'bianca',
    what: 'Content on the local reel',
    when: null,
    houseIds: ['narrativeShifters'],
    tier: 1,
    progress: 'notSet',
  },
  {
    id: 'c13',
    connectorId: 'anette',
    what: 'Run Zine Folding Night at AC Club',
    when: 'This month',
    houseIds: ['culturalWorkers'],
    tier: 2,
    progress: 'inProgress',
  },
];

export const ASKS: readonly Ask[] = [
  {
    id: 'a1',
    what: 'Somebody with a van for the Vizcaya load-in and load-out',
    askedBy: 'Isa Marrero',
    houseIds: ['relationshipBuilding'],
    completed: false,
  },
  {
    id: 'a2',
    what: 'A Haitian Creole translator for the next run of directory postcards',
    askedBy: 'Luz Caraballo',
    houseIds: ['education'],
    completed: false,
  },
];

/**
 * Local businesses and venues acting as community centers. Tracked as a bare
 * count for now — the real version reads from the directory, which already
 * knows who these are.
 */
export const COMMUNITY_GENERATORS = { total: 12, venues: 3 } as const;

// ---------------------------------------------------------------------------
// Derived views
//
// Nothing below is stored. Every number the dashboards print is computed from
// the rows above, so the mock can never drift into saying "26 connectors" over
// a list of 19 — the failure mode that made the original spreadsheet dashboard
// untrustworthy in the first place.
// ---------------------------------------------------------------------------

export function connectorById(id: string): Connector | undefined {
  return CONNECTORS.find((c) => c.id === id);
}

export function commitmentsFor(connectorId: string): Commitment[] {
  return COMMITMENTS.filter((c) => c.connectorId === connectorId);
}

/** Events a connector would plausibly see, nearest first. */
export function upcomingEvents(limit?: number): ConnectorEvent[] {
  const sorted = [...EVENTS].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
}

export interface Tally {
  id: string;
  label: string;
  count: number;
  /** Colour token, where the thing being counted has one. */
  color?: string;
}

export function podTallies(): Tally[] {
  return PODS.map((pod) => ({
    id: pod.id,
    label: pod.name,
    count: CONNECTORS.filter((c) => c.podId === pod.id).length,
  })).sort((a, b) => b.count - a.count);
}

/**
 * House counts, with the unassigned bucket appended last.
 *
 * The bucket is not sorted in with the rest even though it is usually the
 * biggest number on the page. It is not a house, and letting it win the bar
 * chart by sitting at the top would read as though most connectors had chosen
 * something called "Not chosen yet".
 */
export function houseTallies(): Tally[] {
  const houses = HOUSES.map((house) => ({
    id: house.id,
    label: house.name,
    count: CONNECTORS.filter((c) => c.houseId === house.id).length,
    color: house.color,
  })).sort((a, b) => b.count - a.count);

  return [
    ...houses,
    {
      id: 'unassigned',
      label: 'Not chosen yet',
      count: CONNECTORS.filter((c) => c.houseId === null).length,
    },
  ];
}

export function connectorsInHouse(houseId: HouseId): Connector[] {
  return CONNECTORS.filter((c) => c.houseId === houseId);
}

export function connectorsInPod(podId: PodId): Connector[] {
  return CONNECTORS.filter((c) => c.podId === podId);
}

export interface Birthday {
  connector: Connector;
  /** `MM-DD`, already known to be set. */
  date: string;
  daysAway: number;
}

/** The next few birthdays, wrapping across the end of the year. */
export function upcomingBirthdays(limit = 5): Birthday[] {
  const start = today();
  const rows: Birthday[] = [];

  for (const connector of CONNECTORS) {
    if (!connector.birthday) continue;
    const [month, day] = connector.birthday.split('-').map(Number);

    // Try this year first; if it has already gone, roll to next year. Without
    // the roll, a December birthday read in January reports as 300-odd days
    // ago and sorts to the top of a list titled "coming up".
    let next = new Date(start.getFullYear(), month - 1, day);
    if (next < start) next = new Date(start.getFullYear() + 1, month - 1, day);

    rows.push({
      connector,
      date: connector.birthday,
      daysAway: Math.round((next.getTime() - start.getTime()) / 86_400_000),
    });
  }

  return rows.sort((a, b) => a.daysAway - b.daysAway).slice(0, limit);
}

export interface HeadlineStat {
  id: string;
  label: string;
  value: number;
  /** The small line under the number — context, not a second metric. */
  detail: string;
}

export function headlineStats(): HeadlineStat[] {
  const open = COMMITMENTS.filter((c) => c.progress !== 'done');
  const openOwners = new Set(open.map((c) => c.connectorId));
  const recurring = EVENTS.filter((e) => e.cadence !== 'oneTime');
  const completedAsks = ASKS.filter((a) => a.completed);

  return [
    {
      id: 'connectors',
      label: 'Connectors',
      value: CONNECTORS.length,
      detail: `${PODS.length} pods`,
    },
    {
      id: 'commitments',
      label: 'Open commitments',
      value: open.length,
      detail: `from ${openOwners.size} connectors`,
    },
    {
      id: 'events',
      label: 'Upcoming events',
      value: EVENTS.length,
      detail: `${recurring.length} recurring`,
    },
    {
      id: 'asks',
      label: 'Open asks',
      value: ASKS.length - completedAsks.length,
      detail: `${completedAsks.length} completed`,
    },
    {
      id: 'generators',
      label: 'Community generators',
      value: COMMUNITY_GENERATORS.total,
      detail: `${COMMUNITY_GENERATORS.venues} venues`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Viewer simulation
// ---------------------------------------------------------------------------
//
// Removed. The member-facing pages — `/connectors`, `/connectors/join` and
// `/connectors/hq` — no longer simulate anybody: they read the signed-in
// member's own `profiles.connector` record through `lib/connectors/membership`
// and show real data or nothing. `?as=` and the demo viewer went with them,
// because a page that greets a signed-in member by a fixture's name is the
// bug, not the preview.
//
// What is left in this file is the data the admin console still renders. That
// console lives on admin.pana.social and is out of scope here; when it gets
// real tables, this file goes.
