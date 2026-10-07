'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarPlus,
  Lock,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { BrowserFrame } from '../../_components/browser-frame';
import { SURFACE_LOGO } from '../../_data/panaverse';
import { AccountMenu } from './account-menu';
import { DiscoverChrome, type DayChip } from './discover-chrome';
import { EventCard } from './event-card';
import {
  MOCK_EVENTS,
  MOCK_HOST,
  MOCK_PATH,
  type EventType,
  type MockEvent,
  type WhenBucket,
} from '../_data';

/** The nav a directory surface would carry. Not in
 *  `app/mock/_data/panaverse.ts`'s `SURFACE_NAV` because that map is keyed by
 *  surfaces that exist, and this one does not yet — adding it there would put
 *  a fictional surface into the file whose whole value is that it re-exports
 *  the real registry. */
const DIRECTORY_NAV = ['Browse', 'Events', 'Panas', 'Groups'];

/**
 * The masthead a promoted directory surface would fly.
 *
 * Local rather than `SurfaceMasthead` for one reason: that component takes its
 * surfaces from `lib/panaverse/surfaces.ts`, resolved on the server, and the
 * directory is not in that registry. Rather than inventing a fake entry and
 * feeding it to the shared component — which would make the shared component
 * lie about what ships — this draws the same `.panaverse-masthead` classes
 * directly. Same cream bar, same hairline, same indigo tone as the band below
 * it, with the account menu standing where the avatar does.
 */
function DirectoryMasthead({
  menuOpen,
  onToggleMenu,
  signedIn,
  onSignIn,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
  signedIn: boolean;
  onSignIn: () => void;
}) {
  const logo = SURFACE_LOGO.www;

  return (
    <div className="panaverse-masthead" data-tone="indigo">
      <Image
        src={logo.src}
        alt={logo.alt}
        width={logo.width}
        height={logo.height}
        sizes="160px"
        className="panaverse-logo"
      />

      <nav className="panaverse-nav" aria-label="Directory navigation">
        {DIRECTORY_NAV.map((item) => (
          <a key={item} href="#" data-active={item === 'Events'}>
            {item}
          </a>
        ))}
      </nav>

      <div className="ml-auto flex flex-none items-center gap-2">
        {signedIn ? (
          <AccountMenu open={menuOpen} onToggle={onToggleMenu} />
        ) : (
          <button
            type="button"
            className="dirsearch-empty-primary text-[0.8125rem]"
            onClick={onSignIn}
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * /mock/events — the events discover page.
 *
 * Client-side because the filtering is the demonstration. The argument is not
 * any one list of events; it is that the four controls above the grid answer
 * the question people actually arrive with, and that the grid regroups under
 * them without the page changing shape.
 *
 * Drawn inside a `BrowserFrame` rather than full bleed, which the README warns
 * makes a surface read as a picture of a website. That warning is about
 * `/mock/feed`, where the question was "does this feel like its own site".
 * Here the hostname *is* half the proposal — `directory.pana.social/events`
 * does not resolve today — so the address bar is part of what is under review,
 * and the same frame `/mock/panaverse` uses for the same reason is right.
 */
export function EventsDiscover() {
  const [when, setWhen] = useState<WhenBucket | 'all'>('all');
  const [day, setDay] = useState<string | null>(null);
  const [types, setTypes] = useState<EventType[]>([]);
  const [going, setGoing] = useState<string[]>([]);
  const [signedIn, setSignedIn] = useState(true);
  const [menuOpen, setMenuOpen] = useState(true);

  /* Every number on the page is counted off the fixtures. The README's rule,
     and the reason the summary line and the day chips cannot disagree. */
  const days: DayChip[] = useMemo(() => {
    const order: string[] = [];
    const counts = new Map<string, number>();
    for (const event of MOCK_EVENTS) {
      if (!counts.has(event.day)) order.push(event.day);
      counts.set(event.day, (counts.get(event.day) ?? 0) + 1);
    }
    return order.map((d) => ({ day: d, count: counts.get(d) ?? 0 }));
  }, []);

  const shown = useMemo(() => {
    return MOCK_EVENTS.filter((event) => {
      if (day !== null) {
        if (event.day !== day) return false;
      } else if (when !== 'all' && event.bucket !== when) {
        return false;
      }
      if (types.length > 0 && !types.includes(event.type)) return false;
      return true;
    });
  }, [when, day, types]);

  /* Grouped by day rather than listed flat, which is the one structural
     difference between this and a search results page. A search answers a word
     and ranks by relevance; a discover page answers a week, and a week has
     days in it. Grouping is also what makes an empty Tuesday legible — it
     simply has no heading, instead of silently not appearing between two
     cards nobody realised were a day apart. */
  const groups = useMemo(() => {
    const out: { day: string; bucket: WhenBucket; events: MockEvent[] }[] = [];
    for (const event of shown) {
      const last = out[out.length - 1];
      if (last && last.day === event.day) last.events.push(event);
      else out.push({ day: event.day, bucket: event.bucket, events: [event] });
    }
    return out;
  }, [shown]);

  /* The "panas you follow" rail, ranked by how many of them are going rather
     than by date. It is a different question from the grid above — not "what
     is on" but "what are my people doing" — and answering it in date order
     would just be the grid again with fewer cards. */
  const followed = useMemo(
    () =>
      [...MOCK_EVENTS]
        .filter((event) => event.followedGoing > 0)
        .sort((a, b) => b.followedGoing - a.followedGoing)
        .slice(0, 3),
    []
  );

  const weekendCount = MOCK_EVENTS.filter((e) => e.bucket === 'weekend').length;

  const toggleType = (next: EventType) =>
    setTypes((current) =>
      current.includes(next)
        ? current.filter((t) => t !== next)
        : [...current, next]
    );

  const toggleGoing = (id: string) =>
    setGoing((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );

  const clearFilters = () => {
    setWhen('all');
    setDay(null);
    setTypes([]);
  };

  return (
    <>
      <div className="mock-toolbar">
        <span className="mock-toolbar-badge">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Mock
        </span>

        <span className="mock-toolbar-host">
          <Lock className="h-3 w-3 flex-none" aria-hidden="true" />
          {MOCK_HOST}
          {MOCK_PATH}
        </span>

        {/* Signed out is not a smaller version of signed in. It changes the
            masthead, removes the account menu the second half of this request
            is about, and takes away the one section that needs to know who is
            asking. Worth a switch rather than a second route. */}
        <div className="mock-switch ml-auto">
          <button
            type="button"
            data-active={signedIn}
            onClick={() => setSignedIn(true)}
          >
            Signed in
          </button>
          <button
            type="button"
            data-active={!signedIn}
            onClick={() => {
              setSignedIn(false);
              setMenuOpen(false);
            }}
          >
            Signed out
          </button>
        </div>

        <Link href="/mock/directory-unified" className="mock-toolbar-link">
          Directory cards
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <BrowserFrame hostname={MOCK_HOST} path={MOCK_PATH}>
        <DirectoryMasthead
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((open) => !open)}
          signedIn={signedIn}
          onSignIn={() => {
            setSignedIn(true);
            setMenuOpen(true);
          }}
        />

        {/* `.dirscope` is load-bearing, not decoration: the --story-* palette
            is scoped to `body:has(.dirsearch), body:has(.dirscope)` in
            globals.css, so a page carrying neither renders on a transparent
            background with nothing in the console to say why. */}
        <main className="dirscope">
          <DiscoverChrome
            when={when}
            onWhen={setWhen}
            day={day}
            onDay={setDay}
            types={types}
            onToggleType={toggleType}
            days={days}
            totalCount={MOCK_EVENTS.length}
            shownCount={shown.length}
            weekendCount={weekendCount}
          />

          <div className="container mx-auto px-4 pb-16">
            {groups.length > 0 ? (
              groups.map((group) => (
                <section key={group.day} className="pt-8">
                  {/* Capped to `.dirsearch-grid`'s own 58rem and centred with
                      it. A heading that spans the container while the cards
                      below it sit in a narrower centred column reads as two
                      layouts rather than one list with days in it. */}
                  <div className="mx-auto mb-4 flex max-w-[58rem] flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-pana-ink text-[1.0625rem] font-black tracking-[-0.01em]">
                      {group.bucket === 'today' ? 'Tonight' : group.day}
                    </h2>
                    {group.bucket === 'today' && (
                      <span className="text-pana-ink/45 text-[0.8125rem] font-bold">
                        {group.day}
                      </span>
                    )}
                    <span className="text-pana-ink/45 ml-auto text-[0.8125rem] font-bold">
                      {group.events.length}{' '}
                      {group.events.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>

                  <ul className="dirsearch-grid">
                    {group.events.map((event) => (
                      <li key={event.id}>
                        <EventCard
                          event={event}
                          going={going.includes(event.id)}
                          onToggleGoing={toggleGoing}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              /* The directory's own empty state, reused whole. An events page
                 that invents a second one is an events page that will word it
                 differently, and "nothing here" said two ways is the clearest
                 possible signal that two teams built two pages. */
              <div className="dirsearch-empty">
                <CalendarPlus className="h-12 w-12" aria-hidden="true" />
                <h2 className="dirsearch-empty-title">
                  Nothing on with <em>those filters</em>
                </h2>
                <p className="dirsearch-empty-lede">
                  The calendar thins out midweek. Widen the window, or check
                  what else is happening around it.
                </p>
                <div className="dirsearch-empty-actions">
                  <button
                    type="button"
                    className="dirsearch-empty-primary"
                    onClick={clearFilters}
                  >
                    Show everything
                  </button>
                  <button
                    type="button"
                    className="dirsearch-empty-secondary"
                    onClick={() => {
                      setDay(null);
                      setTypes([]);
                      setWhen('weekend');
                    }}
                  >
                    This weekend instead
                  </button>
                </div>
              </div>
            )}

            {/* Signed in, this is the section a search page cannot have: it is
                not ranked by relevance or by date but by who is going, which
                only exists once the viewer does. Signed out it is not empty —
                it is unanswerable — so it becomes the reason to sign in rather
                than a heading over nothing. */}
            <section className="border-pana-ink/10 mx-auto mt-14 max-w-[58rem] border-t pt-10">
              <span className="section-eyebrow">Your panas</span>
              <h2 className="text-pana-ink mt-2 text-[1.375rem] font-black tracking-[-0.015em]">
                {signedIn
                  ? 'Where your panas are going'
                  : 'See where your panas are going'}
              </h2>

              {signedIn ? (
                <ul className="mt-5 grid gap-3">
                  {followed.map((event) => (
                    <li key={event.id}>
                      <Link
                        href={`/e/${event.slug}`}
                        className="border-pana-ink/10 hover:border-pana-ink/30 bg-pana-cream flex items-center gap-4 rounded-2xl border px-4 py-3 transition-colors"
                      >
                        <span
                          className="dirsearch-card-avatars flex-none"
                          aria-hidden="true"
                        >
                          {event.faces.map((face) => (
                            <Image
                              key={face}
                              src={face}
                              alt=""
                              width={26}
                              height={26}
                            />
                          ))}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-pana-ink block truncate text-[0.9375rem] font-black">
                            {event.title}
                          </span>
                          <span className="text-pana-ink/55 block truncate text-[0.8125rem] font-semibold">
                            {event.followedGoing} panas you follow ·{' '}
                            {event.when}
                          </span>
                        </span>
                        <ArrowRight
                          className="text-pana-ink/40 h-4 w-4 flex-none"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <p className="dirsearch-empty-lede max-w-[36rem] text-left">
                    Everything above is public. This part needs an account,
                    because it is built out of who you follow.
                  </p>
                  <div className="dirsearch-empty-actions justify-start">
                    <button
                      type="button"
                      className="dirsearch-empty-primary inline-flex items-center gap-2"
                      onClick={() => {
                        setSignedIn(true);
                        setMenuOpen(true);
                      }}
                    >
                      <UserPlus className="h-4 w-4" aria-hidden="true" />
                      Sign in
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* The directory's closing band, which on this page has somewhere
                better to point than "add your business". Held to the same
                58rem `.dirsearch-cta` uses, so the column does not widen at
                the foot of the page. */}
            <section className="dirsearch-tail mx-auto max-w-[58rem]">
              <span className="section-eyebrow">Hosting something</span>
              <h2 className="section-display">
                Put it on the calendar everyone already checks
              </h2>
              <p className="section-lede">
                Markets, workshops, openings, build nights. Listing is free, and
                it lands in the same place people look for the makers.
              </p>
              <div className="dirsearch-tail-actions">
                <Link href="/e/new" className="dirsearch-tail-primary">
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  Add an event
                </Link>
                <Link
                  href="/directory"
                  className="link-arrow text-pana-indigo font-bold"
                >
                  Browse the directory
                </Link>
              </div>
            </section>

            {/* Per app/mock/README.md, a mock names its own route so a
                screenshot taken out of context still says where it came from. */}
            <p className="mx-auto mt-6 max-w-[58rem] text-center text-xs opacity-60">
              Design mock — <code>/mock/events</code>, drawn as{' '}
              <code>
                {MOCK_HOST}
                {MOCK_PATH}
              </code>
              . That host is not a surface in{' '}
              <code>lib/panaverse/surfaces.ts</code> today and nothing here
              reads the database. The band, cards, facet rail and account menu
              are the shipping classes; the date strip, the day grouping and the
              Events tile&rsquo;s destination are the proposal.
            </p>
          </div>
        </main>
      </BrowserFrame>
    </>
  );
}
