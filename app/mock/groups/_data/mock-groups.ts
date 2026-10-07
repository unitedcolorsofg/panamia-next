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

/** Which of the two proposed pages is on screen. */
export type GroupsPage = 'landing' | 'discover';

/**
 * Whether anyone is signed in.
 *
 * A switch rather than a fixture because it is the landing page's actual
 * design question. Signed out there is no shelf of your own groups, which
 * removes the most useful block on the page and leaves the rest to do the
 * work alone. A landing page that has only ever been reviewed signed in is a
 * landing page nobody has reviewed, since the people it exists to convince
 * are exactly the ones with nothing on the shelf.
 */
export type ViewerAuth = 'member' | 'signedOut';

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
  /** social_group_members row exists for the viewer with status 'active'. */
  joined?: boolean;
  /** A pending join request: status 'pending', joined_at still null. */
  requested?: boolean;
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
  /** events.starts_at, pre-formatted. */
  when: string;
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
    summary:
      'Risograph, screenprint, and photocopy. We trade paper, split ink orders, and run a free bilingual workshop on the first Saturday of the month. Total beginners are the entire point.',
    topics: ['art', 'printmaking', 'workshops'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 428,
    postsThisWeek: 31,
    joined: true,
  },
  {
    id: 'group-2',
    name: 'Little Haiti Tenant Union',
    handle: 'lhtenants',
    avatar: '/img/impact/community-group.webp',
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
    requested: true,
  },
  {
    id: 'group-3',
    name: 'Subtropic Film Collective',
    handle: 'subtropic',
    avatar: '/img/impact/filmmaker-participant.webp',
    summary:
      'Crew calls, gear lending, and rough-cut screenings for independent filmmakers across South Florida.',
    topics: ['film', 'art'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 212,
    postsThisWeek: 14,
    joined: true,
  },
  {
    id: 'group-4',
    name: 'Hialeah Plant Swap',
    handle: 'hialeahplants',
    avatar: '/img/impact/heatwave-visions.webp',
    summary:
      'Cuttings, repotting help, and a monthly swap in the park. Bring something, take something.',
    topics: ['gardening', 'swap'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 156,
    postsThisWeek: 9,
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
    summary: 'Saturday mornings, 6am, flexible pace. Started three weeks ago.',
    topics: ['fitness', 'outdoors'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 6,
    postsThisWeek: 1,
  },
  {
    id: 'group-6',
    name: 'Miami Artist Census Organisers',
    handle: 'artistcensus',
    avatar: '/img/impact/partner-miami-artist-census.webp',
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
  },
  {
    id: 'group-7',
    name: 'Cafecito & Code',
    handle: 'cafecitocode',
    avatar: '/img/impact/partner-allpeep.webp',
    summary:
      'Developers, designers and the self-taught. Weekly coworking at a rotating cafe, plus a thread for job leads that is actually used.',
    topics: ['tech', 'coworking'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 389,
    postsThisWeek: 22,
  },
  {
    id: 'group-8',
    /* A real roster and nothing happening. Dormant is not the same as small,
       and a browse page that only distinguishes big from small will keep
       recommending this one forever. */
    name: 'Coconut Grove Book Swap',
    handle: 'grovebooks',
    avatar: '/img/impact/culture-zines-right.webp',
    summary: 'Paperbacks, trades, and a shelf at the corner shop.',
    topics: ['books', 'swap'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 94,
    postsThisWeek: 0,
  },
  {
    id: 'group-9',
    name: 'Mutual Aid Miami',
    handle: 'mutualaidmia',
    avatar: '/img/impact/partner-miami-workers-center.webp',
    summary:
      'Food runs, ride shares, and hurricane season prep. Anyone can ask and anyone can offer.',
    topics: ['organising', 'mutualaid'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 517,
    postsThisWeek: 48,
  },
  {
    id: 'group-10',
    name: 'Allapattah Salsa Social',
    handle: 'allapattahsalsa',
    avatar: '/img/impact/pana-social-dinner.webp',
    summary: 'Beginner lessons at 8, social dancing until late. Second Friday.',
    topics: ['music', 'dance'],
    visibility: 'public',
    joinPolicy: 'open',
    memberCount: 231,
    postsThisWeek: 7,
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
   checked by groupFor() rather than by eye. */
export const MOCK_GROUP_EVENTS: MockGroupEvent[] = [
  {
    id: 'event-1',
    title: 'First Saturday Riso Workshop',
    when: 'Sat, Mar 1 - 11:00am',
    where: 'Bakehouse Art Complex',
    groupId: 'group-1',
    going: 34,
  },
  {
    id: 'event-2',
    title: 'Rough Cut Night',
    when: 'Thu, Mar 6 - 7:30pm',
    where: 'O Cinema South Beach',
    groupId: 'group-3',
    going: 61,
  },
  {
    id: 'event-3',
    title: 'Hurricane Prep Supply Drive',
    when: 'Sun, Mar 9 - 10:00am',
    where: 'Allapattah Community Garden',
    groupId: 'group-9',
    going: 118,
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
