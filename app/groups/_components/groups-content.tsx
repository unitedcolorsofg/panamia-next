'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  Lock,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import SurfaceLink from '@/components/panaverse/SurfaceLink';
import { useSession } from '@/lib/auth-client';
import {
  useGroupSearch,
  useGroupTopics,
  useMyGroups,
  useUpcomingGroupEvents,
} from '@/lib/query/social';
import { GroupCard, GroupEventRow } from '@/app/groups/_components/group-cards';
import { FilterMenu } from '@/components/ui/filter-menu';

/** How many groups the "active right now" shelf shows before it gets long. */
const ACTIVE_SHELF_LIMIT = 4;

/**
 * The body of /groups.
 *
 * This page is ordered by who is asking rather than by what exists:
 *
 *   1. Browse by interest. "Any interest" was the premise of the feature, and
 *      a search box only serves people who already know the word to type.
 *   2. Active groups right now, as evidence rather than as a claim.
 *   3. Events, which is the argument for a group over a group chat.
 *   4. Start one, last, because it is the answer to "nothing here fits" and
 *      reads as pushy before somebody has looked.
 *
 * Your own groups used to lead this list and no longer appear here at all --
 * they live in the rail, which both this page and discover sit inside. See
 * groups-shell.tsx for why that is a better home than the top of one page.
 *
 * Searching is deliberately NOT done here -- the field is a doorway to
 * /groups/discover. This page used to do both, and the result was that the
 * browse list lived under a search box, which made every visit look like a
 * fresh search even when the visitor just wanted their own groups.
 */
export function GroupsContent() {
  const { data: session, status } = useSession();
  const signedIn = status !== 'loading' && !!session;

  return (
    <div>
      <Hero signedIn={signedIn} />

      <BrowseByInterest />
      <ActiveNow signedIn={signedIn} />
      <ComingUp />
      <StartCta signedIn={signedIn} />
    </div>
  );
}

/**
 * The hero, and the one claim it makes.
 *
 * Two actions, not three. "Find a group" is primary because the far more
 * common arrival is somebody who wants to join something, not start
 * something -- and a page that leads with "Start a group" produces empty
 * groups, which is the worst thing that can happen to a browse page.
 *
 * The search field does not search here. It carries the typed term to
 * /groups/discover, because results underneath would push every other block
 * on this page below the fold the moment anyone types.
 */
function Hero({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();

  return (
    /* Left-aligned, not centred. A centred hero reads as the top of a page
       that owns its whole width; next to the rail it reads as a block that
       has drifted off its own left edge. Everything below it -- section
       heads, cards, the rail itself -- starts at the same line, so this
       does too. */
    <header>
      <span className="card-flag">
        <Users className="h-3 w-3" aria-hidden="true" />
        Pana Social
      </span>

      <h1 className="text-pana-ink mt-3 max-w-2xl text-3xl leading-tight font-extrabold sm:text-4xl">
        Groups are where a shared interest gets a room
      </h1>

      <p className="text-pana-ink/70 mt-3 max-w-xl text-[15px] leading-relaxed font-medium">
        Printmakers, tenant unions, run clubs, salsa nights. A group has its own
        feed, its own events, and its own door &mdash; and it all stays on Pana.
      </p>

      {/* A real form rather than a link, so Enter works and the typed term
          survives the trip. It submits to discover rather than filtering in
          place. */}
      <form
        className="mt-6 flex max-w-xl flex-col gap-2.5 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('q');
          const term = typeof value === 'string' ? value.trim() : '';
          router.push(
            term
              ? `/groups/discover?q=${encodeURIComponent(term)}`
              : '/groups/discover'
          );
        }}
      >
        <label className="border-pana-ink/14 focus-within:border-pana-indigo flex flex-1 items-center gap-2.5 rounded-full border-2 bg-white px-4 py-3 transition-colors">
          <Search
            className="text-pana-ink/40 h-4 w-4 flex-none"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            placeholder="Search groups by name or interest"
            aria-label="Search groups"
            className="text-pana-ink placeholder:text-pana-ink/45 w-full border-0 bg-transparent p-0 text-[14px] font-bold focus:outline-none"
          />
        </label>

        <Link
          href="/groups/new"
          className="bg-pana-ink inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-[14px] font-extrabold text-white"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Start a group
        </Link>
      </form>

      {/* Shown to signed-out visitors rather than hiding the buttons. The page
          at the other end explains what is needed; a control that simply is
          not there reads as the feature not existing. */}
      {!signedIn && (
        <p className="text-pana-ink/50 mt-3 text-[12px] font-bold">
          Browsing is open to everyone. Joining needs an account.
        </p>
      )}
    </header>
  );
}

/**
 * Topic chips, from whatever groups actually carry, folded into a menu.
 *
 * This used to be a spread-out chip row, on the argument that the range of
 * interests IS the pitch on this page -- seeing printmaking next to housing
 * next to salsa is what tells somebody this is not a single-subject site.
 * That argument is still true, and it still lost. The range only sells if
 * somebody reads it, and a block of chips that grows every time a group
 * picks a new topic is the one element here with no ceiling: it pushed the
 * groups themselves -- the actual proof the place is alive -- further down
 * the page with every group added. A pitch that gets worse the better the
 * site does is not a pitch.
 *
 * The hint keeps the honest part of the old claim, naming the breadth
 * ("ceramics to mutual aid") without spending a screen on it.
 *
 * Renders nothing before any group has set a topic, rather than an empty row
 * under a heading promising interests.
 */
function BrowseByInterest() {
  const router = useRouter();
  const { data, isLoading } = useGroupTopics();
  const topics = data?.topics ?? [];

  const options = useMemo(
    () =>
      topics.map(({ topic, count }) => ({
        value: topic,
        label: topic,
        hint: `${count} ${count === 1 ? 'group' : 'groups'}`,
      })),
    [topics]
  );

  if (isLoading) {
    return (
      <div className="mt-12 animate-pulse space-y-3" aria-hidden="true">
        <div className="bg-pana-ink/10 h-6 w-40 rounded-lg" />
        <div className="bg-pana-ink/10 h-9 w-44 rounded-full" />
      </div>
    );
  }

  if (topics.length === 0) return null;

  return (
    <section className="mt-12">
      <SectionHead
        title="Browse by interest"
        hint={`${topics.length} ${topics.length === 1 ? 'topic' : 'topics'} groups are using right now`}
      />

      {/* Nothing is ever "selected" here: picking a topic leaves for discover,
          where the filtering actually happens. `action` is what keeps the rows
          honest about that -- they read as places to go, not boxes to tick. */}
      <div className="mt-4 flex">
        <FilterMenu
          label="Pick an interest"
          options={options}
          selected={[]}
          action
          onChange={([topic]) => {
            if (topic) {
              router.push(
                `/groups/discover?topic=${encodeURIComponent(topic)}`
              );
            }
          }}
        />
      </div>
    </section>
  );
}

/**
 * The busiest open groups this week.
 *
 * Sorted by the server rather than here, using the same 'active' sort the
 * discover page offers, so "active right now" and "Most active" can never
 * disagree.
 *
 * Private groups are filtered out of this shelf even though search returns
 * them: a shelf captioned "open to join" should not be half request-only.
 * They remain findable by name and by topic on discover, which is the point
 * of listing them at all.
 */
function ActiveNow({ signedIn }: { signedIn: boolean }) {
  const { data, isLoading } = useGroupSearch('', 'active');
  const { data: mine } = useMyGroups({ enabled: signedIn });

  /* Derived once for the whole shelf rather than per card. Every card asking
     for its own membership would be the same request N times over. */
  const joined = new Set((mine?.groups ?? []).map((group) => group.id));

  const groups = (data?.groups ?? [])
    .filter((group) => group.visibility === 'public' && !joined.has(group.id))
    .slice(0, ACTIVE_SHELF_LIMIT);

  if (isLoading) {
    return (
      <div className="mt-12 animate-pulse space-y-3" aria-hidden="true">
        <div className="bg-pana-ink/10 h-6 w-40 rounded-lg" />
        <div className="bg-pana-ink/10 h-40 rounded-2xl" />
        <div className="bg-pana-ink/10 h-40 rounded-2xl" />
      </div>
    );
  }

  if (groups.length === 0) return null;

  return (
    <section className="mt-12">
      <SectionHead
        title="Active right now"
        hint="Open to join, busiest this week, with anything they have coming up"
        action={
          <SurfaceLink
            href="/groups/discover"
            className="link-arrow text-pana-indigo text-[13px] font-extrabold"
          >
            Browse all
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </SurfaceLink>
        }
      />

      {/* One column, not a grid of tiles -- the same call the directory
          results make, and for the same reason. Each card carries a cover, a
          logo, an access line, a summary, topics, an event and a row of
          faces; two across squeezes all of that into half a column and the
          cover is the first thing to go. */}
      <div className="mt-4 grid gap-3">
        {groups.map((group) => (
          <GroupCard key={group.id} group={group} showEvents />
        ))}
      </div>
    </section>
  );
}

/**
 * Events across all groups.
 *
 * This is the argument for a group over a group chat, so it gets its own
 * block rather than living only inside the cards above. Renders nothing when
 * nothing is scheduled -- an empty "coming up" is worse than no section.
 */
function ComingUp() {
  const { data, isLoading } = useUpcomingGroupEvents();
  const events = data?.events ?? [];

  if (isLoading || events.length === 0) return null;

  return (
    <section className="mt-12">
      <SectionHead
        title="Coming up in groups"
        hint="Groups host their own events"
      />

      <div className="mt-4 grid gap-3">
        {events.map((event) => (
          <GroupEventRow key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

function SectionHead({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-pana-ink text-[17px] font-extrabold">{title}</h2>
        <p className="text-pana-ink/55 mt-0.5 text-[13px] font-medium">
          {hint}
        </p>
      </div>
      {action}
    </div>
  );
}

/* Last on the page, and phrased as the answer to not finding anything rather
   than as an invitation to skip looking. */
function StartCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="reserved-slot mt-12 items-start p-7">
      <p className="reserved-slot-title inline-flex items-center gap-2">
        <Plus className="h-4 w-4" aria-hidden="true" />
        Nothing here fits?
      </p>
      <p className="text-pana-ink/70 max-w-prose text-[14px] leading-relaxed font-medium">
        A group takes a name, a handle, and a sentence about what it is for. You
        decide whether anyone can join, whether requests get approved, and
        whether it is listed at all.
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <Link
          href="/groups/new"
          className="bg-pana-ink inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-extrabold text-white"
        >
          Start a group
        </Link>

        <span className="text-pana-ink/50 inline-flex items-center gap-1.5 text-[12px] font-bold">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Private groups are never readable from outside
        </span>
      </div>

      {!signedIn && (
        <p className="text-pana-ink/45 mt-1 inline-flex items-center gap-1.5 text-[12px] font-bold">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          Groups can host events once they have a member or two
        </p>
      )}
    </section>
  );
}
