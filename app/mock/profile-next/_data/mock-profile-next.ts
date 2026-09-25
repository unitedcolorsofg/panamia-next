/* Extra fixtures for the revamped personal profile at /mock/profile-next.
 *
 * The person, their posts, their Panas, and their groups are NOT redefined
 * here — they are imported from the existing /mock/profile fixtures. That is
 * deliberate: this route is a re-layout of the same profile, not a different
 * one, and duplicating the person would let the two mocks drift into
 * disagreeing about who Claribel is.
 *
 * What is new is the two sections the old mock only held space for. Both were
 * already written down in its RESERVED_MODULES — "Events & RSVPs" and
 * "Recommended lists" — so this is those placeholders being cashed in rather
 * than new scope invented at the last minute.
 */

export interface MockEvent {
  id: string;
  /** events.title */
  title: string;
  /** events.slug — the live route is /e/[slug]. */
  slug: string;
  /* Pre-split for the date chip. The real thing formats events.startsAt in
     the viewer's timezone; splitting it here keeps the mock honest about the
     fact that the chip needs three separate strings, not one date. */
  month: string;
  day: string;
  weekday: string;
  time: string;
  /** events.venueName */
  venue: string;
  neighborhood: string;
  /* Hosting and going are different relationships to the same event: one is
     the organizer row, the other is an RSVP. They share a card because the
     question a visitor is asking — "where will this person be?" — does not
     distinguish them, but the flag has to, because "hosting" is a claim about
     responsibility. */
  role: 'hosting' | 'going';
  /** Count of accepted RSVPs. */
  attending: number;
  image: string;
  /* Not every RSVP is public. A profile that leaked "going" for every event
     would be a location history, so visibility rides on each row: 'panas' is
     shown to the owner and to mutuals and withheld from everyone else. */
  visibility: 'public' | 'panas';
  past?: boolean;
}

/* Upcoming first, most recent past last. The mock keeps both because a
   profile with only future events looks identical whether the person is
   active or has simply RSVP'd to one thing — the past list is what shows a
   habit rather than an intention. */
export const MOCK_EVENTS: MockEvent[] = [
  {
    id: 'event-1',
    title: 'Bilingual Print Workshop',
    slug: 'bilingual-print-workshop-oct',
    month: 'OCT',
    day: '04',
    weekday: 'Sat',
    time: '2:00 – 5:00 PM',
    venue: 'Little Haiti Cultural Complex',
    neighborhood: 'Little Haiti',
    role: 'hosting',
    attending: 34,
    image: '/img/impact/culture-zines-left.webp',
    visibility: 'public',
  },
  {
    id: 'event-2',
    title: 'Pana Market — Fall Edition',
    slug: 'pana-market-fall',
    month: 'OCT',
    day: '12',
    weekday: 'Sun',
    time: '11:00 AM – 6:00 PM',
    venue: 'Bakehouse Art Complex',
    neighborhood: 'Wynwood',
    role: 'going',
    attending: 412,
    image: '/img/home/EventsBanner.webp',
    visibility: 'public',
  },
  {
    id: 'event-3',
    title: 'Zine Club Monthly Swap',
    slug: 'zine-club-monthly-swap',
    month: 'OCT',
    day: '19',
    weekday: 'Sun',
    time: '7:00 – 9:00 PM',
    venue: "Anette's studio",
    neighborhood: 'Buena Vista',
    role: 'hosting',
    attending: 18,
    image: '/img/impact/zine-series.webp',
    visibility: 'panas',
  },
  {
    id: 'event-4',
    title: 'Long Table Dinner No. 14',
    slug: 'long-table-dinner-14',
    month: 'NOV',
    day: '02',
    weekday: 'Sun',
    time: '6:30 PM',
    venue: 'Rotating host — address on RSVP',
    neighborhood: 'Little River',
    role: 'going',
    attending: 60,
    image: '/img/impact/pana-social-dinner.webp',
    visibility: 'panas',
  },
  {
    id: 'event-5',
    title: 'Heatwave Visions Screening',
    slug: 'heatwave-visions-screening',
    month: 'SEP',
    day: '21',
    weekday: 'Sun',
    time: '8:00 PM',
    venue: 'O Cinema South Beach',
    neighborhood: 'South Beach',
    role: 'going',
    attending: 129,
    image: '/img/impact/heatwave-visions.webp',
    visibility: 'public',
    past: true,
  },
  {
    id: 'event-6',
    title: 'Risograph 101',
    slug: 'risograph-101-sept',
    month: 'SEP',
    day: '06',
    weekday: 'Sat',
    time: '1:00 – 4:00 PM',
    venue: 'Little Haiti Cultural Complex',
    neighborhood: 'Little Haiti',
    role: 'hosting',
    attending: 28,
    image: '/img/impact/community-group.webp',
    visibility: 'public',
    past: true,
  },
];

export interface MockBusiness {
  id: string;
  /** profiles.name */
  name: string;
  /** users.screenname — businesses are profiles too, so the link is /p/[handle]. */
  handle: string;
  /** profiles.categories, first entry */
  category: string;
  neighborhood: string;
  /** profiles.primaryImageCdn */
  image: string;
  /* The Pana's own words. This is the whole reason a recommendation list
     beats a bookmark folder: the directory can already tell you a cafe
     exists, and it cannot tell you that the person you trust works there
     every Tuesday and has opinions about the back tray. */
  note: string;
}

export interface MockRecoList {
  id: string;
  title: string;
  blurb: string;
  updated: string;
  /** Total entries; `businesses` is only the preview the card shows. */
  total: number;
  businesses: MockBusiness[];
}

/* Named lists rather than one flat "recommended" pile. A flat pile forces
   every vouch to mean the same thing, and these do not: the cafe list is a
   routine, the shopping list is a standing intention, and the print list is a
   referral a stranger might act on this afternoon. Naming them is what makes
   them worth reading, and it is what makes one shareable on its own. */
export const MOCK_RECO_LISTS: MockRecoList[] = [
  {
    id: 'list-1',
    title: 'Cafecito crawl',
    blurb:
      'The counters I actually rotate between, in order of how much work I get done at each.',
    updated: 'Updated 2 weeks ago',
    total: 5,
    businesses: [
      {
        id: 'biz-1',
        name: 'Ventanita del Barrio',
        handle: 'ventanitadelbarrio',
        category: 'Café',
        neighborhood: 'Little Haiti',
        image: '/img/directory/cafe-01.jpg',
        note: 'Colada at 7am, no notes. They let me spread proofs across two tables and never once rushed me.',
      },
      {
        id: 'biz-2',
        name: 'Pan y Pana',
        handle: 'panypana',
        category: 'Bakery',
        neighborhood: 'Buena Vista',
        image: '/img/directory/bakery-02.jpg',
        note: 'Guava pastelitos worth planning a morning around. Ask for the ones from the back tray.',
      },
      {
        id: 'biz-3',
        name: 'Tinta Coffee',
        handle: 'tintacoffee',
        category: 'Café',
        neighborhood: 'Little River',
        image: '/img/directory/cafe-03.jpg',
        note: 'Quietest wifi in the 33137. Where I go when a deadline is real.',
      },
    ],
  },
  {
    id: 'list-2',
    title: 'Where I actually shop',
    blurb:
      'Not aspirational. These are the places my money genuinely goes every month.',
    updated: 'Updated last month',
    total: 4,
    businesses: [
      {
        id: 'biz-4',
        name: 'Mercado 305',
        handle: 'mercado305',
        category: 'Market',
        neighborhood: 'Allapattah',
        image: '/img/directory/market-01.jpg',
        note: 'Produce, and the only calabaza in the county that is not half air.',
      },
      {
        id: 'biz-5',
        name: 'Segunda Vuelta',
        handle: 'segundavuelta',
        category: 'Apparel',
        neighborhood: 'Little Havana',
        image: '/img/directory/apparel-03.jpg',
        note: 'Secondhand, sorted by colour by someone who clearly cares. I have never left empty handed.',
      },
    ],
  },
  {
    id: 'list-3',
    title: 'Print & paper people',
    blurb:
      'If you are starting a zine and you ask me where to go, this is the answer I give.',
    updated: 'Updated 3 days ago',
    total: 6,
    businesses: [
      {
        id: 'biz-6',
        name: 'Taller Guaracha',
        handle: 'tallerguaracha',
        category: 'Art studio',
        neighborhood: 'Little Haiti',
        image: '/img/directory/art-02.jpg',
        note: 'Screen printing by the hour. Ramón will tell you what is wrong with your file before you waste a run.',
      },
      {
        id: 'biz-7',
        name: 'Isla Bindery',
        handle: 'islabindery',
        category: 'Services',
        neighborhood: 'Hialeah',
        image: '/img/directory/services-01.jpg',
        note: 'Saddle stitch and perfect binding on short runs. They take a 40-copy job seriously.',
      },
      {
        id: 'biz-8',
        name: 'Papel Papel',
        handle: 'papelpapel',
        category: 'Artisanal goods',
        neighborhood: 'Coral Way',
        image: '/img/directory/artisanal-03.jpg',
        note: 'Paper stock you can handle in person, which matters more than any swatch book admits.',
      },
    ],
  },
];

/* Derived rather than typed in, so a count can never disagree with the list
   sitting underneath it. */
export const MOCK_UPCOMING_COUNT = MOCK_EVENTS.filter(
  (event) => !event.past
).length;

export const MOCK_RECO_TOTAL = MOCK_RECO_LISTS.reduce(
  (sum, list) => sum + list.total,
  0
);
