/* Fixture data for the personal profile mock at /mock/profile.
 *
 * Deliberately hardcoded and deliberately not localized: this route exists to
 * agree on the *shape* of a person's profile across the website and Pana
 * Social before any of it is wired to `profiles`, `socialActors`,
 * `socialFollows`, or `relayGroups`. Every field below is annotated with the
 * column it is standing in for, so the swap to real data is mechanical.
 */

export type ProfileTab = 'posts' | 'panas' | 'following' | 'groups';

export interface MockStat {
  /** Tab this figure opens, so the rail doubles as navigation. */
  tab: ProfileTab;
  label: string;
  value: number;
}

export interface MockPana {
  id: string;
  /** socialActors.name */
  name: string;
  /** users.screenname */
  handle: string;
  /** profiles.primaryImageCdn */
  avatar: string;
  pronouns?: string;
  /** socialActors.summary, clamped to two lines in the card */
  blurb: string;
  /** True when the viewer follows them back — drives the "Panas" label. */
  mutual: boolean;
}

export interface MockBusiness {
  id: string;
  /** profiles.name */
  name: string;
  handle: string;
  image: string;
  /** profiles.categories[0] */
  category: string;
  /** profiles.addressLocality */
  neighborhood: string;
}

export interface MockGroup {
  id: string;
  /** relayGroups.name */
  name: string;
  /** relayGroups.groupId */
  slug: string;
  /** relayGroups.picture */
  image: string;
  /** relayGroups.about */
  blurb: string;
  memberCount: number;
  /** Derived from relayGroupMembers — admins get a marker on the card. */
  role: 'member' | 'admin';
  /** relayGroups.joinPolicy */
  privacy: 'open' | 'invite';
}

export interface MockPost {
  id: string;
  /** socialStatuses.content */
  body: string;
  /** Pre-formatted relative time; socialStatuses.published in the real thing. */
  published: string;
  repliesCount: number;
  likesCount: number;
  announcesCount: number;
  /** socialAttachments — at most one in the mock. */
  image?: string;
  imageAlt?: string;
  /** Set when the post was addressed to a group rather than the timeline. */
  group?: string;
}

export interface MockProfile {
  /** profiles.name */
  name: string;
  /** users.screenname */
  handle: string;
  /** profiles.pronouns */
  pronouns: string;
  /** profiles.descriptions.details */
  bio: string;
  /** profiles.descriptions.fiveWords */
  fiveWords: string;
  /** profiles.primaryImageCdn */
  avatar: string;
  /** socialActors.headerUrl */
  cover: string;
  coverAlt: string;
  /** profiles.addressLocality + addressRegion */
  location: string;
  /** users.createdAt */
  joined: string;
  /** profiles.verification — a claimed, locally based member. */
  verified: boolean;
  stats: MockStat[];
  /** profiles.tags */
  tags: string[];
}

export const MOCK_PROFILE: MockProfile = {
  name: 'Claribel Ávila',
  handle: 'claribel',
  pronouns: 'she/her/ella',
  fiveWords: 'Printmaker, organizer, perpetual snack haver',
  bio: 'Risograph printer and workshop organizer in Little Haiti. I run a zine table at most Pana markets and I will absolutely talk your ear off about paper stock. Looking for collaborators on a bilingual print series about Miami rent.',
  avatar: '/img/about/claribel_avila.jpg',
  cover: '/img/impact/hero-mixer.webp',
  coverAlt: 'Panas gathered around a table at a Pana Mia community mixer',
  location: 'Little Haiti, Miami',
  joined: 'Joined March 2023',
  verified: true,
  tags: ['risograph', 'zines', 'printmaking', 'workshops', 'bilingual'],
  stats: [
    { tab: 'panas', label: 'Panas', value: 1284 },
    { tab: 'following', label: 'Businesses', value: 37 },
    { tab: 'posts', label: 'Posts', value: 216 },
    { tab: 'groups', label: 'Groups', value: 6 },
  ],
};

export const MOCK_POSTS: MockPost[] = [
  {
    id: 'post-1',
    body: 'Pulled 120 copies of the new zine tonight and the registration held on every single one. Little Haiti print gods are being generous. Trade you one for a cafecito.',
    published: '2h',
    repliesCount: 14,
    likesCount: 96,
    announcesCount: 11,
    image: '/img/impact/zine-series.webp',
    imageAlt:
      'A stack of freshly printed risograph zines in orange and blue ink',
  },
  {
    id: 'post-2',
    body: 'Reminder that the bilingual print workshop is Saturday at 2. Bring nothing, leave with a poster. Total beginners are the entire point — you will not be the only one.',
    published: '1d',
    repliesCount: 8,
    likesCount: 143,
    announcesCount: 27,
    group: 'Little Haiti Makers',
  },
  {
    id: 'post-3',
    body: 'Looking for a Pana with a working paper cutter in the 33137 area. Mine finally gave up after four years of heroic service. Will pay in zines and gratitude.',
    published: '3d',
    repliesCount: 31,
    likesCount: 58,
    announcesCount: 19,
  },
  {
    id: 'post-4',
    body: 'Spent the morning at the Pana market table. Met six people building something weird and good. This is the whole reason I keep showing up.',
    published: '6d',
    repliesCount: 5,
    likesCount: 201,
    announcesCount: 8,
    image: '/img/impact/pana-social-dinner.webp',
    imageAlt: 'A long communal dinner table filled with Pana Mia members',
  },
];

export const MOCK_PANAS: MockPana[] = [
  {
    id: 'pana-1',
    name: 'Bee María',
    handle: 'beemaria',
    avatar: '/img/about/bee_maria.jpg',
    pronouns: 'they/them',
    blurb: 'Sound artist. Field recordings from every canal in Broward.',
    mutual: true,
  },
  {
    id: 'pana-2',
    name: 'Anette Mago',
    handle: 'anettemago',
    avatar: '/img/about/anette_mago.jpg',
    pronouns: 'she/her',
    blurb: 'Ceramics, plant swaps, and an unreasonable number of propagations.',
    mutual: true,
  },
  {
    id: 'pana-3',
    name: 'G. Barrios',
    handle: 'gbarrios',
    avatar: '/img/about/gbarrios.jpg',
    pronouns: 'he/him',
    blurb: 'Documentary photographer covering Miami housing.',
    mutual: false,
  },
  {
    id: 'pana-4',
    name: 'J. Downs',
    handle: 'jdowns',
    avatar: '/img/about/jdowns.jpg',
    pronouns: 'he/him',
    blurb: 'Runs the Saturday repair café. Fixes anything with a cord.',
    mutual: true,
  },
];

/* Business thumbnails sit on a white tile, so every logo here must be a dark
   mark. Some partner assets (partner-we-met-community, partner-pana-mia-club)
   are white-on-transparent and render invisible — do not use those. */
export const MOCK_BUSINESSES: MockBusiness[] = [
  {
    id: 'biz-1',
    name: 'Subtropic Film Festival',
    handle: 'subtropic',
    image: '/img/impact/partner-subtropic-film-festival.webp',
    category: 'Film & Media',
    neighborhood: 'Downtown Miami',
  },
  {
    id: 'biz-2',
    name: 'Dale Collective',
    handle: 'dale',
    image: '/img/impact/partner-dale.webp',
    category: 'Community Space',
    neighborhood: 'Allapattah',
  },
  {
    id: 'biz-3',
    name: 'Miami Workers Center',
    handle: 'miamiworkers',
    image: '/img/impact/partner-miami-workers-center.webp',
    category: 'Labor & Advocacy',
    neighborhood: 'Little Havana',
  },
  {
    id: 'biz-4',
    name: 'Radical Partners',
    handle: 'radicalpartners',
    image: '/img/impact/partner-radical-partners.webp',
    category: 'Social Impact',
    neighborhood: 'Miami',
  },
];

export const MOCK_GROUPS: MockGroup[] = [
  {
    id: 'group-1',
    name: 'Little Haiti Makers',
    slug: 'little-haiti-makers',
    image: '/img/impact/community-group.webp',
    blurb: 'Printers, ceramicists, and woodworkers trading studio time.',
    memberCount: 212,
    role: 'admin',
    privacy: 'open',
  },
  {
    id: 'group-2',
    name: 'Zine Club MIA',
    slug: 'zine-club-mia',
    image: '/img/impact/culture-zines-left.webp',
    blurb: 'Monthly swap and a shared table at every market.',
    memberCount: 89,
    role: 'admin',
    privacy: 'open',
  },
  {
    id: 'group-3',
    name: 'Pana Social Dinners',
    slug: 'pana-social-dinners',
    image: '/img/impact/pana-social-dinner.webp',
    blurb: 'Long tables, rotating hosts, no phones at the table.',
    memberCount: 534,
    role: 'member',
    privacy: 'invite',
  },
  {
    id: 'group-4',
    name: 'Heatwave Visions',
    slug: 'heatwave-visions',
    image: '/img/impact/heatwave-visions.webp',
    blurb: 'Climate storytelling collective. Meets the first Tuesday.',
    memberCount: 147,
    role: 'member',
    privacy: 'invite',
  },
  {
    id: 'group-5',
    name: '33137 Mutual Aid',
    slug: '33137-mutual-aid',
    image: '/img/impact/filmfest-collab-left.webp',
    blurb: 'Neighbors covering neighbors. Rides, meals, rent bridges.',
    memberCount: 401,
    role: 'member',
    privacy: 'invite',
  },
  {
    id: 'group-6',
    name: 'Miami Artist Census',
    slug: 'miami-artist-census',
    image: '/img/impact/partner-miami-artist-census.webp',
    blurb: 'Counting who actually makes work here, and what it costs them.',
    memberCount: 318,
    role: 'member',
    privacy: 'open',
  },
];

/* Modules the profile is designed to hold but that have no backing feature
   yet. Rendered as real, sized cards rather than hidden, so the layout does
   not lurch when Pana Social fills them in. */
export interface ReservedModule {
  title: string;
  description: string;
}

export const RESERVED_MODULES: ReservedModule[] = [
  {
    title: 'Events & RSVPs',
    description:
      'Markets, workshops, and dinners this Pana is hosting or attending.',
  },
  {
    title: 'Badges & verification',
    description:
      'Locally based, founding member, group admin, and Gente dePana standing.',
  },
  {
    title: 'Collections',
    description:
      'Saved posts, businesses, and zines this Pana wants to point people at.',
  },
  {
    title: 'Voice memos',
    description:
      'Short audio notes between Panas — already in the social schema, not yet on the profile.',
  },
];
