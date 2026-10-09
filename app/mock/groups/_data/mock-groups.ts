/**
 * Fixtures for the groups landing and discover mocks at /mock/groups.
 *
 * One difference from /mock/group worth stating up front: that mock was drawn
 * before the schema existed, so its annotations were a proposal. These are
 * not. `social_groups`, `social_group_members` and the Group actor all
 * shipped, so every annotation below names a column that is in the database
 * today and can be checked against lib/schema/index.ts.
 *
 * The one thing the annotations do NOT say is where a group's name lives.
 * It is not on `social_groups` -- there is no name column there. A group is an
 * actor, so its name, summary, avatar and cover are all `social_actors`
 * columns, reached through `social_groups.actor_id`. That split is easy to
 * forget and expensive to discover halfway through writing a query, so it is
 * spelled out on each field rather than assumed.
 */

/**
 * Which of the three proposed pages is on screen.
 *
 * `home` is the proposal under review: /groups stops being a pitch and
 * becomes "what is going on with your groups", with the pitch surviving as
 * the empty state and browsing moving to `discover`.
 */
export type GroupsPage = 'home' | 'landing' | 'discover';

/**
 * Who is looking.
 *
 * Three states rather than two, because `home` has three genuinely different
 * renders and the middle one is the easy one to forget. A member with groups
 * gets a digest; a member with none gets the pitch, since a digest of nothing
 * is a worse page than the recruitment page it replaced; a signed-out visitor
 * gets the pitch without a rail.
 *
 * The landing page's original reason for this switch still holds: the people
 * a pitch exists to convince are exactly the ones with nothing on the shelf,
 * so a page only ever reviewed as a member is a page nobody has reviewed.
 */
export type ViewerAuth = 'member' | 'newcomer' | 'signedOut';

export interface MockGroupCard {
  /** social_groups.id */
  id: string;
  /** social_actors.name, via social_groups.actor_id. */
  name: string;
  /** social_actors.username. Groups share the handle namespace with panas,
   *  enforced by lib/screenname.ts, so a group cannot take a taken handle. */
  handle: string;
  /** social_actors.icon_url */
  avatar: string;
  /**
   * social_actors.header_url. Optional on purpose. Setting a header is an
   * extra deliberate step most groups will never take, so the card has to
   * look finished without one -- otherwise every new group starts life
   * looking broken, which is the moment it can least afford to.
   */
  cover?: string;
  /** social_actors.summary */
  summary: string;
  /** social_groups.topics, the `{ topic: true }` JSONB flag map, flattened to
   *  the keys. pana_jsonb_flags (migration 0040) turns this into the search
   *  vector, which is why the chips on these pages and the search box below
   *  them are reading the same column rather than two parallel lists. */
  topics: string[];
  /** social_groups.visibility */
  visibility: 'public' | 'private';
  /** social_groups.join_policy */
  joinPolicy: 'open' | 'request' | 'invite';
  /** social_groups.member_count, denormalised. */
  memberCount: number;
  /**
   * Count of social_statuses in the last seven days where group_id is this
   * group. Not a column -- it would be a windowed count, and it is here
   * because "how alive is this" is the question a browse page is actually
   * being asked. If it proves too expensive to compute per card, that is a
   * finding, and better found now than after the page ships.
   */
  postsThisWeek: number;
  /**
   * Icons of a few members, via social_group_members -> social_actors.icon_url.
   * The card caps the stack, so this only ever needs to hold enough to fill
   * it. Never populated for a private group: who is inside a private group is
   * exactly the thing privacy is protecting, and a row of recognisable faces
   * on a public browse page would leak it more effectively than the member
   * list ever could.
   */
  memberFaces: string[];
  /** social_group_members row exists for the viewer with status 'active'. */
  joined?: boolean;
  /** A pending join request: status 'pending', joined_at still null. */
  requested?: boolean;

  /* ----------------------------------------------------------------------
     Digest fields. Only meaningful when `joined`.
     ---------------------------------------------------------------------- */

  /**
   * social_group_members.role for the viewer's own row.
   *
   * Drives the "needs you" block, which is the one part of the digest that
   * is work rather than news. Mirrors the account menu: admin is the set of
   * groups you answer for.
   */
  role?: 'admin' | 'moderator' | 'member';
  /**
   * Posts since the viewer last opened this group.
   *
   * The one number on this page with no column behind it today. It needs a
   * per-member, per-group last-seen marker -- social_group_members has
   * joined_at but nothing that moves when you read. That is the only new
   * schema the digest requires, and putting the number on screen first is
   * the cheapest way to find out whether it is worth the column.
   */
  newPosts?: number;
  /**
   * The most recent post, for a one-line "what was it about".
   *
   * A count alone makes every group look identical. The excerpt is what
   * turns "12 new" into a reason to click, and it is already in hand --
   * the digest query reads the posts anyway.
   */
  lastActivity?: { who: string; avatar: string; excerpt: string; when: string };
  /**
   * Join requests waiting on the viewer, when they can answer them.
   *
   * Already notified per request by lib/relay/group-notify.ts. This is the
   * standing count, which a notification cannot be: notifications are read
   * once and gone, and a queue is a state.
   */
  pendingRequests?: number;
  /** How long the group has been silent, when nothing is new. */
  quietSince?: string;
}

export interface MockTopic {
  /** The key as it appears in the social_groups.topics flag map. */
  id: string;
  label: string;
}

export interface MockGroupEvent {
  id: string;
  /** events.title */
  title: string;
  /**
   * events.starts_at. Present as well as the formatted strings below because
   * "Sat, Nov 7" cannot be ordered -- anything that sorts or picks the next
   * event has to sort on this.
   */
  startsAt: string;
  /**
   * events.starts_at, formatted. Written out rather than computed from
   * startsAt so the mock reads identically in every timezone, and so a
   * reviewer in London is not shown a different day to one in Miami.
   */
  day: string;
  time: string;
  /** events.location_name */
  where: string;
  /** The hosting group, via events.host_group_id. */
  groupId: string;
  /** Derived from event_attendees where status is 'going'. */
  going: number;
}

/* --------------------------------------------------------------------------
   Groups
   --------------------------------------------------------------------------

   Written against the weaker case on purpose, the same way /mock/dms writes
   its threads. A browse page looks effortless when every fixture is a
   thriving 400-member group with a cover photo and an event this weekend, and
   that is precisely the page that falls apart in production. So this set
   includes the ones that are hard to render well:

     - a group with 6 members and one post, which is what most real groups
       look like in their first month
     - a private group, which has to be listed to be requestable but must not
       show what is inside it
     - an invite-only group, where the primary action is not a button at all
     - a dormant group with a real roster and nothing happening
     - a group whose summary runs long, because real ones do

   If the design reads well across these, it reads well. */
export const MOCK_GROUPS: MockGroupCard[] = [
  {
    id: 'group-1',
    name: 'Miami Print & Zine Makers',
    handle: 'printmakers',
    avatar: '/img/impact/zine-series.webp',
    cover: '/img/directory/art-01.jpg',
    summary:
      'Risograph, screenprint, and photocopy. We trade paper, split ink orders, and run a free bilingual workshop on the first Saturday of the month. Total beginners are the entire point.',
    topics: ['art', 'printmaking', 'workshops'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 428,
    postsThisWeek: 31,
    memberFaces: [
      '/img/about/anette_mago.jpg',
      '/img/about/bee_maria.jpg',
      '/img/about/claribel_avila.jpg',
      '/img/about/gbarrios.jpg',
    ],
    joined: true,
    role: 'admin',
    newPosts: 12,
    lastActivity: {
      who: 'Claribel',
      avatar: '/img/about/claribel_avila.jpg',
      excerpt: 'Ink order closes Friday — add your colours to the thread',
      when: '2h ago',
    },
    /* The group you run, with a queue. Two is deliberately small: the block
       has to justify itself at the size it will usually be, not at the size
       that makes it look urgent. */
    pendingRequests: 2,
  },
  {
    id: 'group-2',
    name: 'Little Haiti Tenant Union',
    handle: 'lhtenants',
    avatar: '/img/impact/community-group.webp',
    cover: '/img/directory/non-profit-01.jpg',
    summary:
      'Organising space for tenants in Little Haiti and Lemon City. An existing member confirms you before you see anything inside.',
    topics: ['organising', 'housing'],
    visibility: 'private',
    joinPolicy: 'request',
    memberCount: 63,
    /* Zero, and not because the group is quiet. A private group's post count
       is not public, so the number a stranger gets is the number they are
       entitled to. The card renders the absence rather than a zero, so this
       never reads as a dead group to the people it most needs. */
    postsThisWeek: 0,
    /* Deliberately empty, and the only group where that is true. See the
       field comment: the faces are a bigger privacy leak than the member
       list, because you do not need to click anything to recognise one. */
    memberFaces: [],
    requested: true,
  },
  {
    id: 'group-3',
    name: 'Subtropic Film Collective',
    handle: 'subtropic',
    avatar: '/img/impact/filmmaker-participant.webp',
    cover: '/img/directory/venue-01.jpg',
    summary:
      'Crew calls, gear lending, and rough-cut screenings for independent filmmakers across South Florida.',
    topics: ['film', 'art'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 212,
    postsThisWeek: 14,
    memberFaces: [
      '/img/about/jdowns.jpg',
      '/img/about/gbarrios.jpg',
      '/img/about/bee_maria.jpg',
      '/img/about/anette_mago.jpg',
    ],
    joined: true,
    role: 'member',
    newPosts: 3,
    lastActivity: {
      who: 'Jorge',
      avatar: '/img/about/jdowns.jpg',
      excerpt: 'Need a sound person for Saturday, paid',
      when: 'yesterday',
    },
  },
  {
    id: 'group-4',
    name: 'Hialeah Plant Swap',
    handle: 'hialeahplants',
    avatar: '/img/impact/heatwave-visions.webp',
    cover: '/img/directory/market-01.jpg',
    summary:
      'Cuttings, repotting help, and a monthly swap in the park. Bring something, take something.',
    topics: ['gardening', 'swap'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 156,
    postsThisWeek: 9,
    memberFaces: [
      '/img/about/claribel_avila.jpg',
      '/img/about/anette_mago.jpg',
      '/img/about/jdowns.jpg',
    ],
  },
  {
    id: 'group-5',
    /* Six members, one post. The most common shape of a real group and the
       one a browse page is worst at: sorted by size it is invisible, sorted
       by recency it outranks groups a hundred times its size. Rendering it
       here forces the sort to answer for itself. */
    name: 'Westchester Run Club',
    handle: 'westrun',
    avatar: '/img/impact/pana-social-app.webp',
    /* No cover, and the only group without one. Three weeks old: nobody has
       got round to a header image yet, which is the normal state of a new
       group rather than an exception. If the card only looks right with one,
       the card is wrong. */
    summary: 'Saturday mornings, 6am, flexible pace. Started three weeks ago.',
    topics: ['fitness', 'outdoors'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 6,
    postsThisWeek: 1,
    /* Two faces for six members. The stack has to stay honest against the
       count next to it -- four overlapping photographs on a six-person group
       would imply a crowd that is not there. */
    memberFaces: ['/img/about/gbarrios.jpg', '/img/about/bee_maria.jpg'],
  },
  {
    id: 'group-6',
    name: 'Miami Artist Census Organisers',
    handle: 'artistcensus',
    avatar: '/img/impact/partner-miami-artist-census.webp',
    cover: '/img/directory/art-02.jpg',
    summary:
      'Working group for the census. Invite only while the current round is open.',
    topics: ['art', 'organising'],
    visibility: 'public',
    /* Invite-only but public, which is the combination that catches people
       out. It is listed, readable, and has no join button -- the only honest
       control is a disabled state with a reason attached. */
    joinPolicy: 'invite',
    memberCount: 24,
    postsThisWeek: 4,
    memberFaces: [
      '/img/about/bee_maria.jpg',
      '/img/about/claribel_avila.jpg',
      '/img/about/gbarrios.jpg',
    ],
  },
  {
    id: 'group-7',
    name: 'Cafecito & Code',
    handle: 'cafecitocode',
    avatar: '/img/impact/partner-allpeep.webp',
    cover: '/img/directory/tech-01.jpg',
    summary:
      'Developers, designers and the self-taught. Weekly coworking at a rotating cafe, plus a thread for job leads that is actually used.',
    topics: ['tech', 'coworking'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 389,
    postsThisWeek: 22,
    memberFaces: [
      '/img/about/gbarrios.jpg',
      '/img/about/jdowns.jpg',
      '/img/about/anette_mago.jpg',
      '/img/about/claribel_avila.jpg',
    ],
  },
  {
    id: 'group-8',
    /* A real roster and nothing happening. Dormant is not the same as small,
       and a browse page that only distinguishes big from small will keep
       recommending this one forever. */
    name: 'Coconut Grove Book Swap',
    handle: 'grovebooks',
    avatar: '/img/impact/culture-zines-right.webp',
    cover: '/img/directory/market-02.jpg',
    summary: 'Paperbacks, trades, and a shelf at the corner shop.',
    topics: ['books', 'swap'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 94,
    postsThisWeek: 0,
    memberFaces: ['/img/about/jdowns.jpg', '/img/about/claribel_avila.jpg'],
    /* Joined, and silent. The case the digest is most likely to get wrong:
       a page built only against busy groups quietly implies that a group
       with nothing new is a group that has failed. It has not -- a book swap
       does not need to post weekly -- so the row has to read as calm rather
       than as broken. */
    joined: true,
    role: 'member',
    newPosts: 0,
    quietSince: 'Oct 2',
  },
  {
    id: 'group-9',
    name: 'Mutual Aid Miami',
    handle: 'mutualaidmia',
    avatar: '/img/impact/partner-miami-workers-center.webp',
    cover: '/img/directory/non-profit-02.jpg',
    summary:
      'Food runs, ride shares, and hurricane season prep. Anyone can ask and anyone can offer.',
    topics: ['organising', 'mutualaid'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 517,
    postsThisWeek: 48,
    memberFaces: [
      '/img/about/anette_mago.jpg',
      '/img/about/claribel_avila.jpg',
      '/img/about/jdowns.jpg',
      '/img/about/bee_maria.jpg',
    ],
  },
  {
    id: 'group-10',
    name: 'Allapattah Salsa Social',
    handle: 'allapattahsalsa',
    avatar: '/img/impact/pana-social-dinner.webp',
    cover: '/img/directory/music-01.jpg',
    summary: 'Beginner lessons at 8, social dancing until late. Second Friday.',
    topics: ['music', 'dance'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 231,
    postsThisWeek: 7,
    memberFaces: [
      '/img/about/bee_maria.jpg',
      '/img/about/gbarrios.jpg',
      '/img/about/anette_mago.jpg',
    ],
  },
  {
    /**
     * A private group the viewer is actually in, and the whole argument for
     * this page.
     *
     * Its event cannot appear on the current /groups landing page: that
     * shelf is fed by /api/social/groups/events, which takes no viewer and
     * returns public groups only, by design -- an event row names a time and
     * a place, so a stranger must not get one for a private group. The
     * consequence nobody chose is that a private group's calendar appears
     * nowhere outside the group itself, not even for its own members.
     *
     * A viewer-aware digest is the place that is allowed to show it, which
     * is why this fixture exists. If the private row renders here and
     * nowhere in discover, the page is doing the thing it was added for.
     */
    id: 'group-11',
    name: 'Thursday Supper Club',
    handle: 'thursdaysupper',
    avatar: '/img/impact/pana-social-dinner.webp',
    summary:
      'Eighteen people, one long table, somebody different cooking each week.',
    topics: ['food'],
    visibility: 'private',
    joinPolicy: 'invite',
    memberCount: 18,
    /* Readable here, unlike group-2's, because the viewer is inside. The
       zero on a private group you are NOT in is a privacy answer; a real
       number for a private group you ARE in is just the truth. */
    postsThisWeek: 5,
    /* Still empty. Membership lets you see the group, and the member list
       is a page you can open -- but a face pile on a digest row is seen by
       anyone glancing at your screen, which is not the same audience. */
    memberFaces: [],
    joined: true,
    role: 'member',
    newPosts: 5,
    lastActivity: {
      who: 'Bee',
      avatar: '/img/about/bee_maria.jpg',
      excerpt: 'I can host the 10th if someone brings a salad',
      when: '6h ago',
    },
  },
];

/* --------------------------------------------------------------------------
   Topics
   --------------------------------------------------------------------------

   The browse-by-interest row, and the piece today's /groups page has no
   equivalent of. The framing for the whole feature was that people join
   groups "based on any interest", and a bare search box only serves somebody
   who already knows the word to type. A topic row is how the page answers
   "I don't know what's here" rather than "find me this".

   The list is fixed here. In production it is the distinct key set of the
   social_groups.topics flag maps, which is why the labels are the only thing
   invented -- the ids are literal column values. */
export const MOCK_TOPICS: MockTopic[] = [
  { id: 'art', label: 'Art & making' },
  { id: 'music', label: 'Music' },
  { id: 'organising', label: 'Organising' },
  { id: 'tech', label: 'Tech' },
  { id: 'film', label: 'Film' },
  { id: 'books', label: 'Books' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'gardening', label: 'Gardening' },
  { id: 'swap', label: 'Swaps' },
  { id: 'housing', label: 'Housing' },
  { id: 'mutualaid', label: 'Mutual aid' },
  { id: 'dance', label: 'Dance' },
  { id: 'workshops', label: 'Workshops' },
  { id: 'coworking', label: 'Coworking' },
  { id: 'outdoors', label: 'Outdoors' },
  { id: 'printmaking', label: 'Printmaking' },
];

/* --------------------------------------------------------------------------
   Events
   -------------------------------------------------------------------------- */

/* Group-hosted events, kept on the landing page because they are the clearest
   answer to "why a group rather than a group chat". A chat cannot put a date
   in your calendar. Every one of these belongs to a group in the list above,
   checked by groupFor() rather than by eye.

   Spread across five groups rather than concentrated in one, because the
   "Active right now" shelf shows an event label per card and that label has
   three states to prove: one event, several events, and none. Two of the
   groups below carry an event for a reason rather than for coverage -- the
   salsa group's own summary already says "Second Friday", and a plant swap
   with no swap on the calendar is not a plant swap.

   Deliberately NOT given to Cafecito & Code, which sits in the same shelf, so
   a card with no event is visible next to cards that have one. */
export const MOCK_GROUP_EVENTS: MockGroupEvent[] = [
  {
    id: 'event-1',
    title: 'First Saturday Riso Workshop',
    startsAt: '2026-11-07T11:00',
    day: 'Sat, Nov 7',
    time: '11:00am',
    where: 'Bakehouse Art Complex',
    groupId: 'group-1',
    going: 34,
  },
  {
    id: 'event-2',
    title: 'Rough Cut Night',
    startsAt: '2026-11-12T19:30',
    day: 'Thu, Nov 12',
    time: '7:30pm',
    where: 'O Cinema South Beach',
    groupId: 'group-3',
    going: 61,
  },
  {
    id: 'event-3',
    title: 'Thanksgiving Food Run',
    startsAt: '2026-11-15T10:00',
    day: 'Sun, Nov 15',
    time: '10:00am',
    where: 'Allapattah Community Garden',
    groupId: 'group-9',
    going: 118,
  },
  {
    id: 'event-4',
    title: 'Monthly Swap in the Park',
    startsAt: '2026-11-14T09:00',
    day: 'Sat, Nov 14',
    time: '9:00am',
    where: 'Amelia Earhart Park',
    groupId: 'group-4',
    going: 42,
  },
  {
    id: 'event-5',
    title: 'Second Friday Beginner Lesson',
    startsAt: '2026-11-13T20:00',
    day: 'Fri, Nov 13',
    time: '8:00pm',
    where: 'Allapattah Collective',
    groupId: 'group-10',
    going: 76,
  },
  /* The second event for group-9, and the only reason the plural label has
     anything to render. */
  {
    id: 'event-6',
    title: 'Ride Share Sign-Up',
    startsAt: '2026-11-19T18:30',
    day: 'Thu, Nov 19',
    time: '6:30pm',
    where: 'Online',
    groupId: 'group-9',
    going: 27,
  },
  /* The private group's dinner, and the row that only the digest is allowed
     to render. It is the soonest event in the whole fixture on purpose: if
     the digest sorts honestly it leads with this, and the contrast with the
     public shelf -- where it must never appear -- is visible in one glance. */
  {
    id: 'event-7',
    title: 'Supper at Bee’s',
    startsAt: '2026-11-05T19:00',
    day: 'Thu, Nov 5',
    time: '7:00pm',
    where: 'Buena Vista',
    groupId: 'group-11',
    going: 11,
  },
];

/* --------------------------------------------------------------------------
   Derived values
   --------------------------------------------------------------------------

   Everything below is computed from the fixtures above rather than typed, per
   the convention in app/mock/README.md. The rule earns its keep on exactly
   this kind of page: a topic chip reading "Art & making 12" that filters down
   to three results is the most common bug in a browse UI, and it is
   impossible to write here because the chip and the filter call the same
   function. */

/** Groups carrying a topic. The one filter both pages share. */
export function groupsForTopic(topic: string): MockGroupCard[] {
  return MOCK_GROUPS.filter((group) => group.topics.includes(topic));
}

/** Topics that actually have groups, with their counts, busiest first. */
/**
 * The display name for a topic key. Falls back to the raw key, which is the
 * honest answer: topics are free-form JSONB flags, so a group can carry one
 * that was never added to MOCK_TOPICS. Showing the key beats dropping the
 * chip, because a missing chip looks like the group has fewer interests
 * rather than like the label list is behind.
 */
export function topicLabel(id: string): string {
  return MOCK_TOPICS.find((topic) => topic.id === id)?.label ?? id;
}

export function topicsWithCounts(): { topic: MockTopic; count: number }[] {
  return MOCK_TOPICS.map((topic) => ({
    topic,
    count: groupsForTopic(topic.id).length,
  }))
    .filter((entry) => entry.count > 0)
    .sort(
      (a, b) => b.count - a.count || a.topic.label.localeCompare(b.topic.label)
    );
}

/** The viewer's own groups. */
export function yourGroups(): MockGroupCard[] {
  return MOCK_GROUPS.filter((group) => group.joined);
}

/**
 * The group hosting an event.
 *
 * Returns undefined rather than throwing, and callers render nothing when it
 * is missing, so a fixture typo shows up as a missing row instead of a white
 * screen in the middle of a review.
 */
export function groupFor(event: MockGroupEvent): MockGroupCard | undefined {
  return MOCK_GROUPS.find((group) => group.id === event.groupId);
}

/**
 * Every upcoming event, soonest first.
 *
 * Sorted here rather than maintained in order in the fixture, because the
 * fixture is grouped by host for readability and the page has to show the
 * nearest date first regardless of who is hosting it.
 */
export function upcomingEvents(): MockGroupEvent[] {
  return [...MOCK_GROUP_EVENTS].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt)
  );
}

/**
 * Upcoming events a stranger is allowed to see: public groups only.
 *
 * This is what /api/social/groups/events already returns, and the landing
 * page's shelf has to go through it rather than through `upcomingEvents`.
 * The distinction is not cosmetic -- an event row names a date and an
 * address, so a private group's calendar on a public browse page is a
 * sharper leak than its member list would be.
 *
 * The split exists at all because the digest needs the unfiltered set.
 */
export function publicUpcomingEvents(): MockGroupEvent[] {
  return upcomingEvents().filter((event) => {
    const host = groupFor(event);
    return host?.visibility === 'public';
  });
}

/**
 * What the viewer's own groups have coming up, soonest first.
 *
 * Private groups included, and that inclusion is the entire point: the
 * viewer is a member, so there is no leak, and today this row has nowhere
 * else in the product to appear. Membership is the authorization here, in
 * the same way it is the authorization for the group arm of the home
 * timeline -- see getHomeTimeline, which reaches the same conclusion from
 * the other direction.
 */
export function yourUpcomingEvents(): MockGroupEvent[] {
  const mine = new Set(yourGroups().map((group) => group.id));
  return upcomingEvents().filter((event) => mine.has(event.groupId));
}

/**
 * The viewer's groups, ordered by how much they want attention.
 *
 * Not alphabetical and not by size. A digest is read top-down and abandoned
 * partway, so the order is the design: anything waiting on you first, then
 * whatever has news, then the quiet ones, which are still worth listing
 * because a group you forgot about is the one most likely to need you.
 */
export function yourGroupsByPulse(): MockGroupCard[] {
  return [...yourGroups()].sort((a, b) => {
    const queue = (g: MockGroupCard) => (g.pendingRequests ?? 0) > 0;
    if (queue(a) !== queue(b)) return queue(a) ? -1 : 1;
    return (b.newPosts ?? 0) - (a.newPosts ?? 0);
  });
}

/** Groups the viewer can answer join requests for, and the total waiting. */
export function groupsNeedingYou(): MockGroupCard[] {
  return yourGroups().filter(
    (group) =>
      (group.pendingRequests ?? 0) > 0 &&
      (group.role === 'admin' || group.role === 'moderator')
  );
}

/**
 * A group's upcoming events, soonest first.
 *
 * The card label and the events list below it both come through here, so the
 * date a card advertises is the same row the visitor finds further down the
 * page -- the same reason topic chips and topic filters share one function.
 */
export function eventsForGroup(groupId: string): MockGroupEvent[] {
  return upcomingEvents().filter((event) => event.groupId === groupId);
}

/**
 * Search, matching what the real endpoint can actually do.
 *
 * Name, handle, summary and topics -- the same four things migration 0040's
 * search vector covers. Deliberately not fuzzy: the production search is
 * Postgres full-text, so a mock that matched typos would be promising a
 * behaviour the backend does not have.
 */
export function searchGroups(
  term: string,
  topic: string | null
): MockGroupCard[] {
  const needle = term.trim().toLowerCase();

  return MOCK_GROUPS.filter((group) => {
    /* Private groups are listed on purpose -- that is how a request-to-join
       group gets asked. The reason runs out when there is nothing to ask:
       a private group that is also invite-only has no door a browser can
       knock on, so listing it advertises a room nobody can enter and leaks
       its existence for nothing in return. Private + request stays. */
    if (group.visibility === 'private' && group.joinPolicy === 'invite') {
      return false;
    }
    if (topic && !group.topics.includes(topic)) return false;
    if (!needle) return true;

    return (
      group.name.toLowerCase().includes(needle) ||
      group.handle.toLowerCase().includes(needle) ||
      group.summary.toLowerCase().includes(needle) ||
      group.topics.some((entry) => entry.includes(needle))
    );
  });
}

/** How the discover page can be ordered. */
export type GroupSort = 'active' | 'largest' | 'newest';

export const GROUP_SORTS: { id: GroupSort; label: string }[] = [
  { id: 'active', label: 'Most active' },
  { id: 'largest', label: 'Largest' },
  { id: 'newest', label: 'Newest' },
];

/**
 * Ordering, which is the real design decision on the discover page.
 *
 * `active` sorts on posts this week rather than member count, and the
 * six-member run club in the fixtures is why. Sorted by size it never
 * surfaces, and a browse page that only ever shows the ten biggest groups
 * cannot grow an eleventh. Size is still offered, just not as the default.
 */
export function sortGroups(
  groups: MockGroupCard[],
  sort: GroupSort
): MockGroupCard[] {
  const sorted = [...groups];

  if (sort === 'largest') {
    return sorted.sort((a, b) => b.memberCount - a.memberCount);
  }

  if (sort === 'newest') {
    /* Newest has no created_at in these fixtures, so it is faked by reversing
       id order rather than by inventing dates that would then disagree with
       the "started three weeks ago" in a summary. Named here so review does
       not read this ordering as real. */
    return sorted.reverse();
  }

  return sorted.sort(
    (a, b) => b.postsThisWeek - a.postsThisWeek || b.memberCount - a.memberCount
  );
}
