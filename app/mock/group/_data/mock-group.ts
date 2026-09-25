/**
 * Fixtures for the group home page mock at /mock/group.
 *
 * Deliberately hardcoded and deliberately not localized: this route exists to
 * agree on the *shape* of a group before any of it is wired up. Every field is
 * annotated with the column it stands in for, so the swap to real data is
 * mechanical — exactly as /mock/feed and /mock/profile do it.
 *
 * The difference from those two is that the columns below **do not exist yet**.
 * `social_groups`, `social_group_members`, `social_statuses.group_id` and
 * `group_messages` are all proposed in docs/GROUPS-ROADMAP.md and land in
 * migration 0043 onward. That is the point of mocking this before building it:
 * the annotations are a design review of the schema, not a description of it.
 *
 * Nothing here maps to the existing NIP-29 `relay_groups` tables. Those are a
 * separate bring-your-own-client feature that cannot host events, cannot be
 * searched, and keeps its messages on a relay rather than in Postgres — see
 * the roadmap for why this feature does not build on them.
 */

import type { MockPost } from '../../feed/_data/mock-feed';

/* Posts are imported from the feed mock rather than redefined.
 *
 * That is a design statement, not a shortcut. A group post IS a status — in
 * the proposed schema it is a `social_statuses` row that happens to carry a
 * `group_id` — so it has to be the same card with the same affordances, or the
 * architecture is lying about what a group post is. Sharing the type keeps the
 * two mocks from drifting into two different answers.
 */
export type { MockPost };

/** Which tab the group page is showing. */
export type GroupTab = 'posts' | 'events' | 'members';

/**
 * Who is looking. This is the most important control on the page.
 *
 * `locked` is not a decorative third option. The roadmap flags private-group
 * leakage as the highest-severity risk in the feature — every path that reads
 * `social_statuses` needs a membership filter, and the failure mode is silent.
 * Giving the non-member view of a private group a first-class state means the
 * design has to answer "what does a stranger see" on screen, in review, rather
 * than in a code comment nobody reads.
 */
export type ViewerState = 'member' | 'visitor' | 'locked';

export interface MockGroupMember {
  id: string;
  /** social_actors.name */
  name: string;
  /** users.screenname — groups share the flat handle namespace. */
  handle: string;
  /** social_actors.icon_url */
  avatar: string;
  /** social_group_members.role */
  role: 'admin' | 'moderator' | 'member';
  /** social_group_members.joined_at, pre-formatted. */
  joined: string;
}

export interface MockGroupEvent {
  id: string;
  /** events.title */
  title: string;
  /** events.starts_at, pre-formatted. */
  when: string;
  /** events.location_name */
  where: string;
  /** events.cover_image */
  image: string;
  /** Derived from event_attendees where status is 'going'. */
  going: number;
  /** Derived from event_attendees where status is 'interested'. */
  interested: number;
  /** True when the viewer is already on the list. */
  rsvped?: boolean;
}

export interface MockGroup {
  /** social_groups.id */
  id: string;
  /** social_groups.name */
  name: string;
  /** The group's handle. Shares the namespace enforced by lib/screenname.ts,
   *  which is why a group cannot take a handle a pana already holds. */
  handle: string;
  /** social_actors.icon_url on the group's Group actor. */
  avatar: string;
  /** social_actors.image_url on the group's Group actor. */
  cover: string;
  coverAlt: string;
  /** social_groups.summary */
  summary: string;
  /** social_groups.topics, the JSONB {key: true} flag map. Feeds search. */
  topics: string[];
  /** social_groups.visibility */
  visibility: 'public' | 'private';
  /** social_groups.join_policy */
  joinPolicy: 'open' | 'request' | 'invite';
  /** social_groups.member_count, denormalised so the rail never counts rows. */
  memberCount: number;
  /** Count of social_statuses where group_id is this group. */
  postCount: number;
  /** Count of events where host_group_id is this group. */
  eventCount: number;
  /** social_groups.created_at, pre-formatted. */
  founded: string;
  /** Free text the admins set. No column is proposed for this yet — it is
   *  rendered here so the omission is visible while the schema is still cheap
   *  to change. */
  rules: string[];
}

/* --------------------------------------------------------------------------
   The group
   -------------------------------------------------------------------------- */

export const MOCK_GROUP: MockGroup = {
  id: 'group-1',
  name: 'Miami Print & Zine Makers',
  handle: 'printmakers',
  avatar: '/img/impact/zine-series.webp',
  cover: '/img/impact/culture-zines-left.webp',
  coverAlt: 'Risograph zines in orange and blue ink drying on a rack',
  summary:
    'Risograph, screenprint, and photocopy. We trade paper, split ink orders, and run a free bilingual workshop on the first Saturday of the month. Total beginners are the entire point.',
  topics: ['printmaking', 'zines', 'diy', 'miami-dade'],
  visibility: 'public',
  joinPolicy: 'open',
  memberCount: 428,
  postCount: 1240,
  eventCount: 3,
  founded: 'Founded March 2024',
  rules: [
    'Trade and split costs freely. No reselling group ink orders.',
    'Workshop seats go to first-timers first.',
    'Spanish and English both welcome in any thread.',
  ],
};

/* A private group the viewer is not in, rendered only in the `locked` state.
   Deliberately a different group rather than the one above with its contents
   hidden, so review cannot mistake one for the other.

   The counts stay visible. Membership size is not the secret — the posts are,
   and a group that hid its own existence could never be requested to join. */
export const MOCK_PRIVATE_GROUP: MockGroup = {
  id: 'group-2',
  name: 'Little Haiti Tenant Union',
  handle: 'lhtenants',
  avatar: '/img/impact/community-group.webp',
  cover: '/img/impact/hero-mixer.webp',
  coverAlt: 'Neighbours gathered around folding tables at a community meeting',
  summary:
    'Organising space for tenants in Little Haiti and Lemon City. An existing member confirms you before you see anything inside.',
  topics: ['housing', 'organising', 'little-haiti'],
  visibility: 'private',
  joinPolicy: 'request',
  memberCount: 63,
  postCount: 0,
  eventCount: 0,
  founded: 'Founded August 2024',
  rules: [],
};

/* --------------------------------------------------------------------------
   Members
   -------------------------------------------------------------------------- */

export const MOCK_MEMBERS: MockGroupMember[] = [
  {
    id: 'member-1',
    name: 'Claribel Ávila',
    handle: 'claribel',
    avatar: '/img/about/claribel_avila.jpg',
    role: 'admin',
    joined: 'Founder',
  },
  {
    id: 'member-2',
    name: 'Bee María',
    handle: 'beemaria',
    avatar: '/img/about/bee_maria.jpg',
    role: 'moderator',
    joined: 'Joined Apr 2024',
  },
  {
    id: 'member-3',
    name: 'Anette Mago',
    handle: 'anettemago',
    avatar: '/img/about/anette_mago.jpg',
    role: 'member',
    joined: 'Joined Jun 2024',
  },
  {
    id: 'member-4',
    name: 'G. Barrios',
    handle: 'gbarrios',
    avatar: '/img/about/gbarrios.jpg',
    role: 'member',
    joined: 'Joined Sep 2024',
  },
  {
    id: 'member-5',
    name: 'J. Downs',
    handle: 'jdowns',
    avatar: '/img/about/jdowns.jpg',
    role: 'member',
    joined: 'Joined Jan 2025',
  },
];

/* --------------------------------------------------------------------------
   Events
   -------------------------------------------------------------------------- */

export const MOCK_EVENTS: MockGroupEvent[] = [
  {
    id: 'event-1',
    title: 'Bilingual print workshop — total beginners',
    when: 'Sat 4 Oct · 2:00 PM',
    where: 'Little Haiti Cultural Complex',
    image: '/img/impact/filmmaker-participant.webp',
    going: 34,
    interested: 61,
    rsvped: true,
  },
  {
    id: 'event-2',
    title: 'Group ink order — pickup day',
    when: 'Sat 18 Oct · 11:00 AM',
    where: 'Claribel’s studio, Lemon City',
    image: '/img/impact/zine-series.webp',
    going: 19,
    interested: 12,
  },
  {
    id: 'event-3',
    title: 'Zine swap at the mixer',
    when: 'Fri 7 Nov · 7:00 PM',
    where: 'Pana Mia Mixer, Wynwood',
    image: '/img/impact/hero-mixer.webp',
    going: 88,
    interested: 140,
  },
];

/* --------------------------------------------------------------------------
   Posts
   -------------------------------------------------------------------------- */

/* Every post carries `group`, because on this page every post is addressed to
   this group. The card renders that as "Posted in …", which is redundant here
   and load-bearing in the feed — the same component has to work in both
   places, and this is the page that proves it does. */
export const MOCK_GROUP_POSTS: MockPost[] = [
  {
    id: 'gpost-1',
    author: {
      name: 'Claribel Ávila',
      handle: 'claribel',
      avatar: '/img/about/claribel_avila.jpg',
      county: 'Miami-Dade',
    },
    body: 'Ink order closes Friday. We are at 11 of the 15 we need for the bulk price on fluorescent pink, so if you have been thinking about it this is the week. Reply here and I will add you to the sheet.',
    published: '3h',
    repliesCount: 22,
    likesCount: 74,
    announcesCount: 4,
    group: 'Miami Print & Zine Makers',
    topReply: {
      author: {
        name: 'J. Downs',
        handle: 'jdowns',
        avatar: '/img/about/jdowns.jpg',
      },
      body: 'in for two. can pick up for anyone in the grove while i am there',
      published: '2h',
    },
  },
  {
    id: 'gpost-2',
    author: {
      name: 'Bee María',
      handle: 'beemaria',
      avatar: '/img/about/bee_maria.jpg',
      county: 'Miami-Dade',
    },
    body: 'First pull off the new drum. Registration held on all 120 and I did not cry once. Trade you one for a cafecito.',
    published: '9h',
    repliesCount: 8,
    likesCount: 133,
    announcesCount: 17,
    group: 'Miami Print & Zine Makers',
    liked: true,
    attachments: [
      {
        src: '/img/impact/zine-series.webp',
        alt: 'A stack of freshly printed risograph zines in orange and blue ink',
      },
    ],
  },
  {
    id: 'gpost-3',
    author: {
      name: 'Anette Mago',
      handle: 'anettemago',
      avatar: '/img/about/anette_mago.jpg',
    },
    body: 'Reminder that Saturday is beginners-first. If you have printed before, come at 4 for the open studio instead so the seats go to people who have never touched a press.',
    published: '1d',
    repliesCount: 3,
    likesCount: 51,
    announcesCount: 9,
    group: 'Miami Print & Zine Makers',
    location: 'Little Haiti',
  },
  {
    id: 'gpost-4',
    author: {
      name: 'G. Barrios',
      handle: 'gbarrios',
      avatar: '/img/about/gbarrios.jpg',
      county: 'Broward',
    },
    body: 'Long shot — does anyone still have the bilingual setup guide we handed out last spring? I want to reprint a stack for Saturday and I have lost every copy.',
    published: '2d',
    repliesCount: 11,
    likesCount: 28,
    announcesCount: 2,
    group: 'Miami Print & Zine Makers',
    ccLicense: 'CC BY-SA',
  },
];

/* --------------------------------------------------------------------------
   Related groups
   -------------------------------------------------------------------------- */

export interface MockRelatedGroup {
  id: string;
  name: string;
  handle: string;
  image: string;
  memberCount: number;
  /** Why this group is being suggested. Names the mechanism rather than
   *  presenting the suggestion as an oracle — "31 members in common" is a
   *  claim the database can actually back. */
  reason: string;
}

export const MOCK_RELATED: MockRelatedGroup[] = [
  {
    id: 'rel-1',
    name: 'Miami Artist Census',
    handle: 'artistcensus',
    image: '/img/impact/partner-miami-artist-census.webp',
    memberCount: 902,
    reason: 'Shares the printmaking topic',
  },
  {
    id: 'rel-2',
    name: 'Heatwave Visions',
    handle: 'heatwave',
    image: '/img/impact/heatwave-visions.webp',
    memberCount: 214,
    reason: '31 members in common',
  },
  {
    id: 'rel-3',
    name: 'Little Haiti Makers',
    handle: 'lhmakers',
    image: '/img/impact/community-group.webp',
    memberCount: 156,
    reason: 'Also in Miami-Dade',
  },
];

/* --------------------------------------------------------------------------
   Reserved
   -------------------------------------------------------------------------- */

/* Space held open in the rail, the same treatment the feed and profile mocks
   use. These are things a group page is expected to grow, and that this design
   deliberately does not invent data for. */
export const RESERVED_MODULES: { title: string; description: string }[] = [
  {
    title: 'Shared files',
    description:
      'Templates, setup guides, and the bilingual handout, kept where a new member can find them.',
  },
  {
    title: 'Member map',
    description:
      'Who is near which neighbourhood, so a pickup does not need a thread to arrange.',
  },
];
