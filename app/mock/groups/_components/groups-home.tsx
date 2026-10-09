'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Compass,
  Lock,
  MessageSquare,
  Shield,
  UserPlus,
} from 'lucide-react';
import {
  groupFor,
  groupsNeedingYou,
  yourGroupsByPulse,
  yourUpcomingEvents,
  type MockGroupCard,
  type MockGroupEvent,
} from '../_data/mock-groups';

/**
 * The proposed /groups for somebody who is already in groups.
 *
 * Today that person lands on a pitch. The page opens "Groups are where a
 * shared interest gets a room", explains what a group is, and offers ten
 * interest chips -- to a member of four groups. It got worse rather than
 * better when the rail shipped: your own groups moved out of the column into
 * the rail, which was right, but nothing took their place, so the main column
 * is now recruitment material end to end.
 *
 * What this page is NOT is a feed, and that is the one decision here worth
 * defending. `getHomeTimeline` already carries a dedicated group arm -- posts
 * from groups you are in reach your main feed on membership alone, private
 * groups included, with no follow and no public addressing. A stream here
 * would be those same posts a second time, in a second place, with a second
 * unread state to keep in sync.
 *
 * So it is a digest: the three things the home feed structurally cannot tell
 * you, because a merged chronological stream has no idea which room a message
 * came from.
 *
 *   1. What is waiting on you. A join request notifies the leaders once, and
 *      a notification is read and gone. A queue is a state, and states need
 *      somewhere to live.
 *   2. What is coming up in YOUR groups. The existing shelf is fed by
 *      /api/social/groups/events, which takes no viewer and returns public
 *      groups only -- correctly, since an event row names a date and an
 *      address. The consequence is that a private group's calendar currently
 *      appears nowhere outside the group page itself, including to its own
 *      members. This block is the first place allowed to show it.
 *   3. Which group is actually alive. The feed interleaves, so it cannot say
 *      "Clay & Kiln has been quiet since October" -- the absence of posts is
 *      invisible in a stream by definition.
 *
 * Discover moves to its own page and is reached from the rail and from the
 * bottom of this one, because browsing is what you do occasionally and
 * checking in is what you do often.
 */
export function GroupsHome({
  onOpenDiscover,
}: {
  onOpenDiscover: (topic?: string) => void;
}) {
  const needsYou = groupsNeedingYou();
  const events = yourUpcomingEvents();
  const groups = yourGroupsByPulse();

  return (
    <div>
      <header>
        <h1 className="text-pana-ink text-2xl leading-tight font-extrabold sm:text-[27px]">
          Your groups
        </h1>
        <p className="text-pana-ink/60 mt-1.5 text-[14px] font-medium">
          {summarise(groups, events.length)}
        </p>
      </header>

      {needsYou.length > 0 && <NeedsYou groups={needsYou} />}

      {events.length > 0 && <ComingUp events={events} />}

      <section className="mt-10">
        <h2 className="text-pana-ink text-[17px] font-extrabold">
          What&rsquo;s happened
        </h2>
        <p className="text-pana-ink/55 mt-0.5 text-[13px] font-medium">
          Since you last opened each one
        </p>

        <div className="mt-4 grid gap-2.5">
          {groups.map((group) => (
            <PulseRow key={group.id} group={group} />
          ))}
        </div>
      </section>

      <DiscoverFooter onOpenDiscover={onOpenDiscover} />

      <p className="border-pana-ink/10 text-pana-ink/55 mt-14 border-t pt-6 text-[13px] font-bold">
        Design mock of a reshaped <code>/groups</code>. The live page today is
        the pitch on the Landing tab above, shown to members and strangers
        alike. This proposes the pitch becomes the empty state, browsing moves
        to <code>/groups/discover</code>, and the front door answers &ldquo;what
        is going on with my groups&rdquo; instead.
      </p>
    </div>
  );
}

/**
 * The one line at the top.
 *
 * Counts rather than a greeting. "Good afternoon, Jose" is a sentence the
 * page has to render before it has said anything, and it is the same sentence
 * every time -- whereas "two groups have news" is different tomorrow, which
 * is the only reason to put a line here at all.
 */
function summarise(groups: MockGroupCard[], eventCount: number): string {
  const withNews = groups.filter((group) => (group.newPosts ?? 0) > 0).length;

  const news =
    withNews === 0
      ? 'Nothing new since you last looked'
      : `${withNews} ${withNews === 1 ? 'group has' : 'groups have'} new posts`;

  if (eventCount === 0) return news;

  return `${news} · ${eventCount} ${eventCount === 1 ? 'event' : 'events'} coming up`;
}

/**
 * Join requests waiting on you.
 *
 * First on the page and visually separated, because it is the only block that
 * is work rather than reading. Everything below can be skipped with no
 * consequence; this cannot -- somebody is sitting in a queue waiting to be
 * let in, and until a leader acts they are stuck outside a room they asked to
 * enter.
 *
 * Rendered only when there is something in it. An empty "nothing needs you"
 * card is a reassurance nobody asked for, and it would push the real content
 * down on every single visit to say that nothing happened.
 */
function NeedsYou({ groups }: { groups: MockGroupCard[] }) {
  const total = groups.reduce(
    (sum, group) => sum + (group.pendingRequests ?? 0),
    0
  );

  return (
    <section className="border-pana-orange/35 bg-pana-orange/[0.07] mt-7 rounded-2xl border-2 p-4">
      <p className="text-pana-ink inline-flex items-center gap-2 text-[14px] font-extrabold">
        <Shield className="text-pana-orange h-4 w-4" aria-hidden="true" />
        {total} {total === 1 ? 'person is' : 'people are'} waiting to be let in
      </p>

      <ul className="mt-3 grid gap-2">
        {groups.map((group) => (
          <li key={group.id}>
            <Link
              href="/mock/group"
              className="border-pana-ink/10 hover:border-pana-indigo group flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition-colors"
            >
              {/* Plain <img> throughout: next.config.js declares no
                  remotePatterns, so the optimizer rejects remote avatars. */}
              <img
                src={group.avatar}
                alt=""
                className="border-pana-ink/10 h-8 w-8 flex-none rounded-lg border object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="text-pana-ink group-hover:text-pana-indigo block truncate text-[13.5px] font-extrabold transition-colors">
                  {group.name}
                </span>
                <span className="text-pana-ink/55 block text-[12px] font-bold">
                  {group.pendingRequests}{' '}
                  {group.pendingRequests === 1 ? 'request' : 'requests'}
                </span>
              </span>
              <span className="text-pana-indigo inline-flex flex-none items-center gap-1 text-[12.5px] font-extrabold">
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Review
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What your groups have coming up.
 *
 * Above the activity list rather than below it, because an event has a
 * deadline and a post does not. Missing a post costs nothing; missing the
 * supper club by scrolling past it is the page failing at its job.
 */
function ComingUp({ events }: { events: MockGroupEvent[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-pana-ink text-[17px] font-extrabold">Coming up</h2>
      <p className="text-pana-ink/55 mt-0.5 text-[13px] font-medium">
        Across the groups you are in
      </p>

      <div className="mt-4 grid gap-2.5">
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

/**
 * One event.
 *
 * Deliberately not the shared `GroupEventRow` from the browse pages. That row
 * is selling an event to somebody deciding whether to care, so it leads with
 * the host and carries an attendee count as social proof. This row is a
 * reminder for somebody who has already joined, so it leads with the date --
 * the only part you are scanning for -- and the group name is context rather
 * than a pitch.
 */
function EventRow({ event }: { event: MockGroupEvent }) {
  const host = groupFor(event);
  const isPrivate = host?.visibility === 'private';

  return (
    <Link
      href="/mock/group"
      className="border-pana-ink/10 hover:border-pana-indigo group flex items-center gap-3.5 rounded-2xl border-2 bg-white p-3 transition-colors"
    >
      {/* The date as a block rather than a sentence. Six of these stack into
          a scannable column of dates; six sentences do not. */}
      <span className="bg-pana-ink/[0.04] flex h-[52px] w-[52px] flex-none flex-col items-center justify-center rounded-xl">
        <span className="text-pana-ink/50 text-[10px] leading-none font-black tracking-wide uppercase">
          {event.day.split(',')[0]}
        </span>
        <span className="text-pana-ink mt-0.5 text-[15px] leading-none font-extrabold">
          {event.day.split(' ').slice(-1)[0]}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-pana-ink group-hover:text-pana-indigo block truncate text-[14.5px] leading-tight font-extrabold transition-colors">
          {event.title}
        </span>
        <span className="text-pana-ink/55 mt-1 block truncate text-[12.5px] font-bold">
          {event.time} · {event.where}
        </span>
        <span className="text-pana-ink/45 mt-0.5 flex items-center gap-1 text-[12px] font-bold">
          {isPrivate && (
            /* The marker that makes the privacy rule visible in the mock
               rather than only true in the data. This row exists nowhere
               else in the product. */
            <Lock className="h-3 w-3 flex-none" aria-hidden="true" />
          )}
          {host?.name}
        </span>
      </span>

      <span className="text-pana-ink/45 hidden flex-none text-[12px] font-bold sm:block">
        {event.going} going
      </span>
    </Link>
  );
}

/**
 * One group, and whether anything happened in it.
 *
 * The excerpt is the reason this is a digest and not a list of counts. "12
 * new posts" is the same sentence for every group on a busy week and tells
 * you nothing about which one to open; one line of the most recent post is
 * what makes the choice for you.
 *
 * A quiet group still gets a row. Dropping it would make the page shorter and
 * strictly worse -- the group you have forgotten about is the one most likely
 * to need somebody to post in it, and hiding it guarantees nobody will.
 */
function PulseRow({ group }: { group: MockGroupCard }) {
  const news = group.newPosts ?? 0;
  const isPrivate = group.visibility === 'private';

  return (
    <Link
      href="/mock/group"
      className="border-pana-ink/10 hover:border-pana-indigo group flex items-start gap-3.5 rounded-2xl border-2 bg-white p-3.5 transition-colors"
    >
      <img
        src={group.avatar}
        alt=""
        className="border-pana-ink/10 h-11 w-11 flex-none rounded-xl border object-cover"
      />

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-pana-ink group-hover:text-pana-indigo text-[14.5px] leading-tight font-extrabold transition-colors">
            {group.name}
          </span>

          {isPrivate && (
            <Lock
              className="text-pana-ink/35 h-3 w-3 flex-none"
              aria-label="Private group"
            />
          )}

          {/* Only for the groups you answer for, matching the account menu:
              a moderator badge here would be a job description, not a
              reminder. */}
          {group.role === 'admin' && (
            <span className="text-pana-ink/50 bg-pana-ink/[0.05] rounded-full px-2 py-0.5 text-[10.5px] font-black tracking-wide uppercase">
              You run this
            </span>
          )}

          {news > 0 && (
            <span className="bg-pana-indigo/10 text-pana-indigo inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold">
              <MessageSquare className="h-3 w-3" aria-hidden="true" />
              {news} new
            </span>
          )}
        </span>

        {group.lastActivity ? (
          <span className="mt-2 flex items-center gap-2">
            <img
              src={group.lastActivity.avatar}
              alt=""
              className="h-5 w-5 flex-none rounded-full object-cover"
            />
            <span className="text-pana-ink/70 min-w-0 flex-1 truncate text-[13px] font-medium">
              <span className="font-extrabold">{group.lastActivity.who}</span>{' '}
              {group.lastActivity.excerpt}
            </span>
            <span className="text-pana-ink/40 hidden flex-none text-[11.5px] font-bold sm:block">
              {group.lastActivity.when}
            </span>
          </span>
        ) : (
          /* Phrased as a fact, not a failure. "No activity" reads like a
             warning light; "Quiet since Oct 2" is just what happened, and
             leaves the member to decide whether that is a problem. */
          <span className="text-pana-ink/45 mt-2 block text-[13px] font-medium">
            Quiet since {group.quietSince}
          </span>
        )}
      </span>
    </Link>
  );
}

/* Last, and small. Browsing is the occasional trip and checking in is the
   frequent one, so discover gets a line at the bottom rather than the top of
   the page it used to own. The rail carries the same link for anyone who
   wants it without scrolling. */
function DiscoverFooter({
  onOpenDiscover,
}: {
  onOpenDiscover: (topic?: string) => void;
}) {
  return (
    <section className="border-pana-ink/10 mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed px-4 py-3.5">
      <p className="text-pana-ink/70 text-[13.5px] font-bold">
        Looking for something else?
      </p>

      <button
        type="button"
        onClick={() => onOpenDiscover()}
        className="text-pana-indigo inline-flex items-center gap-1.5 text-[13.5px] font-extrabold"
      >
        <Compass className="h-4 w-4" aria-hidden="true" />
        Discover groups
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </section>
  );
}
