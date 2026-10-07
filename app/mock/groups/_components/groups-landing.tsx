'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Lock,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import {
  sortGroups,
  searchGroups,
  topicsWithCounts,
  upcomingEvents,
  yourGroups,
  type ViewerAuth,
} from '../_data/mock-groups';
import { GroupCard, GroupEventRow, TopicChip } from './group-cards';

/**
 * The proposed /groups landing page.
 *
 * What is there today is a working page but not a landing page: an H1, a
 * "Start a group" button, your own groups if you have any, and a search box
 * over a flat list. It answers "find me this" well and "what is this, and why
 * would I want one" not at all -- which is a problem now that a Groups tile
 * in the account menu sends people here cold.
 *
 * So this page is ordered by who is asking rather than by what exists:
 *
 *   1. Your groups, if you have any. Somebody opening this page is far more
 *      often going back somewhere than looking for somewhere new, and their
 *      own list is the one thing no search box can produce. This is the one
 *      part of today's page that survives untouched.
 *   2. Browse by interest. The missing piece. "Any interest" was the premise
 *      of the feature, and a search box only serves people who already know
 *      the word to type.
 *   3. Active groups right now, as evidence rather than as a claim.
 *   4. Events, which is the argument for a group over a group chat.
 *   5. Start one, last, because it is the answer to "nothing here fits" and
 *      reads as pushy before somebody has looked.
 *
 * Searching is deliberately NOT done on this page. The field is a doorway to
 * /groups/discover. Today's page does both and the result is that the browse
 * list has to live under a search box, which makes every visit look like a
 * fresh search even when the visitor just wanted their own groups.
 */
export function GroupsLanding({
  viewer,
  onOpenDiscover,
}: {
  viewer: ViewerAuth;
  onOpenDiscover: (topic?: string) => void;
}) {
  const mine = yourGroups();
  const signedIn = viewer === 'member';
  const topics = topicsWithCounts();

  /* Sorted by the same function the discover page uses, so "active right now"
     here and "Most active" there can never disagree. */
  const active = sortGroups(searchGroups('', null), 'active')
    .filter((group) => !group.joined && group.visibility === 'public')
    .slice(0, 4);

  return (
    <div className="container mx-auto max-w-5xl px-4 pt-8">
      <Hero signedIn={signedIn} onOpenDiscover={onOpenDiscover} />

      {/* Signed out there is no shelf, because there are no groups of yours
          to put on it -- the same rule the live page already follows. An
          empty-state card here would be worse than nothing: it would tell
          somebody who has never joined a group that they have no groups. */}
      {signedIn && mine.length > 0 && (
        <section className="mt-12">
          <SectionHead
            title="Your groups"
            hint={`${mine.length} you are in`}
            action={
              <Link
                href="/mock/group"
                className="link-arrow text-pana-indigo text-[13px] font-extrabold"
              >
                See all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            }
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {mine.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <SectionHead
          title="Browse by interest"
          hint="Every group carries its own topics"
        />

        {/* Chips rather than a dropdown. A dropdown hides the range of what
            exists behind a click, and the range IS the pitch on this page --
            seeing printmaking next to housing next to salsa is what tells
            somebody this is not a single-subject site. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {topics.map(({ topic, count }) => (
            <TopicChip
              key={topic.id}
              topic={topic}
              count={count}
              active={false}
              onSelect={() => onOpenDiscover(topic.id)}
            />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <SectionHead
          title="Active right now"
          hint="Open to join, busiest this week, with anything they have coming up"
          action={
            <button
              type="button"
              onClick={() => onOpenDiscover()}
              className="link-arrow text-pana-indigo text-[13px] font-extrabold"
            >
              Browse all
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          }
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {active.map((group) => (
            <GroupCard key={group.id} group={group} showEvents />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <SectionHead
          title="Coming up in groups"
          hint="Groups host their own events"
        />

        <div className="mt-4 grid gap-3">
          {upcomingEvents().map((event) => (
            <GroupEventRow key={event.id} event={event} />
          ))}
        </div>
      </section>

      <StartCta signedIn={signedIn} />

      <p className="border-pana-ink/10 text-pana-ink/55 mt-14 border-t pt-6 text-[13px] font-bold">
        Design mock of <code>/groups</code> at <code>/mock/groups</code>, with
        hardcoded data. The live page today is a search box over a flat list;
        this splits it, leaving browsing here and searching on{' '}
        <code>/groups/discover</code>. Group cards are shared with that page
        rather than redrawn.
      </p>
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
 * The search field here does not search. It opens discover with whatever has
 * been typed, which is the behaviour it needs rather than a limitation of the
 * mock: results underneath would push every other block on this page below
 * the fold the moment anyone types.
 */
function Hero({
  signedIn,
  onOpenDiscover,
}: {
  signedIn: boolean;
  onOpenDiscover: (topic?: string) => void;
}) {
  return (
    <header className="text-center">
      <span className="card-flag mx-auto">
        <Users className="h-3 w-3" aria-hidden="true" />
        Pana Social
      </span>

      <h1 className="text-pana-ink mx-auto mt-3 max-w-2xl text-3xl leading-tight font-extrabold sm:text-4xl">
        Groups are where a shared interest gets a room
      </h1>

      <p className="text-pana-ink/70 mx-auto mt-3 max-w-xl text-[15px] leading-relaxed font-medium">
        Printmakers, tenant unions, run clubs, salsa nights. A group has its own
        feed, its own events, and its own door -- and it all stays on Pana.
      </p>

      <div className="mx-auto mt-6 flex max-w-xl flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={() => onOpenDiscover()}
          className="border-pana-ink/14 text-pana-ink/55 hover:border-pana-indigo flex flex-1 items-center gap-2.5 rounded-full border-2 bg-white px-4 py-3 text-left text-[14px] font-bold transition-colors"
        >
          <Search className="h-4 w-4 flex-none" aria-hidden="true" />
          Search groups by name or interest
        </button>

        <Link
          href="/mock/groups"
          className="bg-pana-ink inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-[14px] font-extrabold text-white"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Start a group
        </Link>
      </div>

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
          href="/mock/groups"
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
