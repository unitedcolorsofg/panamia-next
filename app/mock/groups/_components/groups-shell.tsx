'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarDays, Compass, Plus, Users } from 'lucide-react';
import {
  upcomingEvents,
  yourGroups,
  type GroupsPage,
  type ViewerAuth,
} from '../_data/mock-groups';

/**
 * The two-column shell both groups pages sit in.
 *
 * The shelf of your own groups used to be the first block of the landing
 * page, which gave it the worst of both placements. It pushed the browse
 * blocks -- the whole reason somebody who is not already in a group opens
 * this page -- below the fold for members, and it vanished entirely the
 * moment you went to discover, which is exactly when you most want to hop
 * back to a group you are already in.
 *
 * A rail fixes both. It is out of the vertical flow, so the page can lead
 * with whatever the page is for, and it survives the trip to discover, so
 * your groups stop being a destination and start being navigation. This is
 * the shape Discord, Slack and Reddit all converged on for the same reason:
 * the list of rooms you are in is not content, it is the way around.
 *
 * It is also deliberately the *left* rail rather than the right. The right
 * rail on this site is where suggestions and context live -- things you may
 * want. The left is where you already are.
 *
 * Below `lg` there is no room for a column, so the rail becomes a horizontal
 * strip of avatars above the content. It keeps the "your groups are always
 * reachable" promise without stealing a third of a phone screen, and it is
 * the one place the old top-shelf placement was actually right.
 */
export function GroupsShell({
  viewer,
  page,
  onNavigate,
  children,
}: {
  viewer: ViewerAuth;
  page: GroupsPage;
  onNavigate: (page: GroupsPage) => void;
  children: ReactNode;
}) {
  return (
    /* Wider than the max-w-5xl the pages used alone: the rail costs about
       250px, and without the extra room the cards beside it would reflow
       from two columns to one and undo the point of the change. */
    <div className="container mx-auto max-w-6xl px-4 pt-8">
      <GroupsStrip viewer={viewer} />

      <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <GroupsRail viewer={viewer} page={page} onNavigate={onNavigate} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

/**
 * The rail itself. Desktop only.
 *
 * Sticky below the masthead rather than scrolling away, because a navigation
 * element you have to scroll back up to reach is not navigation. `top-24`
 * clears the sticky masthead above it; `max-h` plus its own scroll keeps a
 * member of thirty groups from pushing the Start button off the screen.
 */
function GroupsRail({
  viewer,
  page,
  onNavigate,
}: {
  viewer: ViewerAuth;
  page: GroupsPage;
  onNavigate: (page: GroupsPage) => void;
}) {
  const signedIn = viewer === 'member';
  const mine = signedIn ? yourGroups() : [];

  return (
    <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] flex-col overflow-y-auto pb-4 lg:flex">
      <nav className="flex flex-col gap-1">
        <RailNav
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
          label="Groups"
          active={page === 'landing'}
          onClick={() => onNavigate('landing')}
        />
        <RailNav
          icon={<Compass className="h-4 w-4" aria-hidden="true" />}
          label="Discover"
          active={page === 'discover'}
          onClick={() => onNavigate('discover')}
        />
      </nav>

      <div className="border-pana-ink/10 mt-5 border-t pt-5">
        {signedIn && mine.length > 0 ? (
          <>
            <div className="text-pana-ink/45 px-2 text-[11px] font-black tracking-[0.08em] uppercase">
              Your groups
            </div>

            <ul className="mt-2 flex flex-col gap-0.5">
              {mine.map((group) => (
                <li key={group.id}>
                  <RailGroup group={group} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          /* A prompt rather than an empty column. The landing page refuses to
             render an empty-state card for this, and is right to -- a
             full-width card telling somebody they have no groups pushes the
             real content down to say nothing. A rail is different: the column
             exists either way, so the choice is between a sentence and a
             hole. */
          <p className="text-pana-ink/55 bg-pana-ink/[0.03] rounded-2xl px-3 py-3 text-[13px] leading-relaxed font-medium">
            {signedIn
              ? 'Groups you join show up here, so you can get back to them from anywhere.'
              : 'Sign in and the groups you join show up here.'}
          </p>
        )}
      </div>

      <Link
        href="/mock/group"
        className="border-pana-ink/14 hover:border-pana-indigo hover:text-pana-indigo text-pana-ink/70 mt-4 inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-dashed px-3 py-2.5 text-[13px] font-extrabold transition-colors"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Start a group
      </Link>
    </aside>
  );
}

function RailNav({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'bg-pana-indigo/10 text-pana-indigo flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] font-extrabold'
          : 'text-pana-ink/65 hover:bg-pana-ink/[0.04] hover:text-pana-ink flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] font-bold transition-colors'
      }
    >
      <span className="flex-none">{icon}</span>
      {label}
    </button>
  );
}

/**
 * One group in the rail.
 *
 * Carries a signal, not a stat. The cards on the page proper spell out member
 * counts and posts-this-week because a stranger deciding whether to join
 * needs them; somebody scanning a rail for a room they are already in does
 * not. What they want to know is "has anything happened since I looked",
 * which is a dot, and "is something coming up", which is a date -- both read
 * at a glance without stopping to compare numbers.
 */
function RailGroup({
  group,
}: {
  group: ReturnType<typeof yourGroups>[number];
}) {
  const next = upcomingEvents().find((event) => event.groupId === group.id);

  return (
    <Link
      href="/mock/group"
      className="hover:bg-pana-ink/[0.04] group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors"
    >
      {/* Plain <img>: next.config.js declares no remotePatterns, so the
          optimizer rejects remote CDN avatars at runtime. */}
      <img
        src={group.avatar}
        alt=""
        className="border-pana-ink/10 h-8 w-8 flex-none rounded-lg border object-cover"
      />

      <span className="min-w-0 flex-1">
        <span className="text-pana-ink group-hover:text-pana-indigo block truncate text-[13.5px] leading-tight font-extrabold transition-colors">
          {group.name}
        </span>
        {next && (
          <span className="text-pana-ink/50 mt-0.5 flex items-center gap-1 text-[11.5px] leading-tight font-bold">
            <CalendarDays className="h-3 w-3 flex-none" aria-hidden="true" />
            {next.day}
          </span>
        )}
      </span>

      {/* Unread-ish signal. Deliberately a dot and not a count: a number
          invites you to clear it, and a group feed is not an inbox. */}
      {group.postsThisWeek > 0 && (
        <span
          className="bg-pana-indigo mt-0.5 h-1.5 w-1.5 flex-none self-start rounded-full"
          aria-label={`${group.postsThisWeek} posts this week`}
        />
      )}
    </Link>
  );
}

/**
 * The phone fallback: a horizontal strip of the groups you are in.
 *
 * Avatars with names under them rather than rows, because the whole value on
 * a narrow screen is that it costs one line instead of six. Renders nothing
 * when there is nothing to put in it, which is the one case where silence
 * beats a prompt -- a phone has no empty column to fill.
 */
function GroupsStrip({ viewer }: { viewer: ViewerAuth }) {
  const mine = viewer === 'member' ? yourGroups() : [];
  if (mine.length === 0) return null;

  return (
    <div className="mb-6 lg:hidden">
      <div className="text-pana-ink/45 mb-2 text-[11px] font-black tracking-[0.08em] uppercase">
        Your groups
      </div>

      {/* Negative margin plus matching padding so the row can bleed to the
          screen edge while its first and last items still clear it. */}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {mine.map((group) => (
          <Link
            key={group.id}
            href="/mock/group"
            className="w-[68px] flex-none text-center"
          >
            <span className="relative block">
              <img
                src={group.avatar}
                alt=""
                className="border-pana-ink/10 h-[52px] w-[52px] rounded-2xl border object-cover"
              />
              {group.postsThisWeek > 0 && (
                /* Sat on the corner rather than outside it. A 2xl radius
                   means the very corner of the box is empty space, so a
                   badge pinned there floats free of the avatar instead of
                   belonging to it. */
                <span
                  className="bg-pana-indigo absolute top-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface-cream,#fff)]"
                  aria-label={`${group.postsThisWeek} posts this week`}
                />
              )}
            </span>
            <span className="text-pana-ink/70 mt-1.5 block truncate text-[11.5px] leading-tight font-bold">
              {group.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
