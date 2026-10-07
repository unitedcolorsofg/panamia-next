import Link from 'next/link';
import { Suspense } from 'react';
import { CalendarDays } from 'lucide-react';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { DirectorySuggest } from '@/components/directory-suggest';
import { ScopeMenuLive } from '@/components/scope-menu-live';
import EventCard from '@/components/events/EventCard';
import { countFor, totalCount } from '@/lib/directory-scopes';
import { countAllScopes } from '@/lib/server/search-kinds';
import { getUpcomingEvents, searchUpcomingEvents } from '@/lib/event';
import { EventsFrontDoor } from './_components/events-front-door';

/** Events per page. One full grid; the calendar has never paginated. */
const EVENT_LIMIT = 24;

/** Cards in the loading skeleton. One row at the widest breakpoint. */
const SKELETON_CARDS = 6;

/* Typed structurally rather than as `Metadata`: the vinext `next` shim does
   not export that type. */
export const metadata = {
  title: 'Events | Pana MIA',
  description:
    'Discover in-person and online community events across the Pana MIA network.',
  alternates: { canonical: '/e' },
  // Indexed, unlike /panas and /groups. A public event wants to be found by
  // someone searching for it who has never heard of the club.
  robots: { index: true, follow: true },
};

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

/**
 * /e — the events explore page.
 *
 * This was a flat "here is everything upcoming" calendar, which is the right
 * page when there are twelve events and the wrong one at eighty. The scope
 * menu moving to the homepage made that gap load-bearing: picking Events there
 * now lands here with a term, and a page with no way to receive one would have
 * dropped what the visitor typed on the floor.
 *
 * The term rides in `?q=`. Not a choice — `/e/[slug]` already owns the segment
 * after this root, so `/e/cumbia` is an event slug, not a search. /groups and
 * /panas use the same grammar for the same reason, and the directory keeps its
 * path segments because its URLs are the public, indexed ones.
 *
 * Browse and search render the identical `EventCard` grid, because
 * `searchUpcomingEvents` was written to return the same rows as
 * `getUpcomingEvents`. The obvious alternative — reusing `searchEvents` from
 * lib/server/search-kinds — flattens an event into a `ScopeSearchResult` and
 * loses the cover art, attendance and venue the card is built around, so the
 * page would have visibly degraded the moment someone typed into it.
 *
 * Counts are only fetched when there is a term. The menu's numbers answer
 * "how many of these matched what I typed", and on an empty browse there is
 * nothing for them to count.
 *
 * With no term at all this is not a browse but the front door, so it hands
 * off to the discovery feed. Those are two different questions: "show me
 * everything matching cumbia" wants a complete grid, while someone arriving
 * at /e with nothing typed is asking what is worth going to, which a flat
 * list of everything upcoming answers badly. Search still lands here from the
 * homepage scope menu and still renders the grid below.
 */
export default async function EventsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const term = (q ?? '').trim();

  if (!term) return <EventsFrontDoor />;

  return (
    <main className="dirscope">
      <EventsBand term={term} />

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Keyed so a new term swaps back to the skeleton rather than leaving
            the previous term's events under a heading that already changed. */}
        <Suspense key={`event:${term}`} fallback={<ResultsSkeleton />}>
          <EventResults term={term} />
        </Suspense>
      </div>
    </main>
  );
}

/**
 * The band: headline, count, search pill.
 *
 * Same furniture as the directory and /panas on purpose. The four kinds are
 * four products now, but someone who searches "cumbia" here and "cumbia" in
 * the directory should not feel they have changed websites.
 */
function EventsBand({ term }: { term: string }) {
  return (
    <section className="dirsearch-band">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="section-eyebrow">Events</span>

            <h1 className="dirsearch-title">
              {term ? (
                <>
                  <em>{term}</em> — events
                </>
              ) : (
                <>What&rsquo;s happening</>
              )}
            </h1>

            {/* Suspended rather than awaited by the page, so the heading and
                the search box are on screen while the counting happens. The
                number is worth showing and not worth waiting for. */}
            <p className="dirsearch-count" role="status" aria-live="polite">
              {!term ? (
                <>In-person and online events from the Pana MIA community</>
              ) : (
                <Suspense key={`count:${term}`} fallback={<>Searching…</>}>
                  <EventMatchCount term={term} />
                </Suspense>
              )}
            </p>
          </div>

          {/* Kept from the old calendar. Discovery and creation are the same
              errand often enough that making someone find the events page,
              then hunt for a way in, was the gap worth closing. */}
          <Button asChild className="shrink-0">
            <Link href="/e/new">
              <CalendarDays className="mr-2 h-4 w-4" />
              Host an Event
            </Link>
          </Button>
        </div>

        {/* The scope control sits inside the pill rather than beside it,
            because scope is part of the question being asked — "events in
            Wynwood" is one query, not a query plus a page setting. */}
        <div className="dirsearch-searchrow">
          <DirectorySuggest
            layout="pill"
            scope="event"
            initialTerm={term}
            label="Search events"
            ariaLabel="Search events"
            placeholder="Markets, shows, workshops…"
            buttonLabel="Search"
            leading={<ScopeMenuLive scope="event" term={term} />}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * How many events matched, and how much is waiting in the other three scopes.
 *
 * Does its own `auth()` instead of taking `signedIn` from the page, because
 * the page no longer resolves a session at all: nothing above this needs one.
 * Events are public, so a failed session read costs this component only the
 * pana half of the "more elsewhere" figure.
 */
async function EventMatchCount({ term }: { term: string }) {
  let signedIn = false;
  try {
    const session = await auth();
    signedIn = Boolean(session?.user?.id);
  } catch (error) {
    // Anonymous is the safe fall-back: events are public either way, and the
    // only thing the session changes here is whether gated panas are counted.
    console.error('Events page session error:', error);
  }

  let counts;
  try {
    counts = (await countAllScopes(term, signedIn)).counts;
  } catch (error) {
    // The grid below runs its own query and says its own piece if that fails.
    // A count that cannot be computed is better left unsaid than guessed at.
    console.error('Events page count error:', error);
    return null;
  }

  const scoped = countFor(counts, 'event');
  const total = totalCount(counts);

  if (scoped === 0) return <>No events matched yet — try fewer words</>;

  return (
    <>
      <strong>{scoped}</strong>
      {scoped === 1 ? ' event' : ' events'}
      {/* Only mention the rest of the club when there is a rest to mention.
          "2 events, of 2 results club-wide" is noise. */}
      {total > scoped && <> · {total - scoped} more elsewhere</>}
    </>
  );
}

/**
 * The grid, or the reason there isn't one.
 *
 * Split out as its own component so the band above can flush before the event
 * query resolves. Without the boundary a suspending child holds up the whole
 * payload and nothing — not the title, not the search box — reaches the
 * browser until the database answers.
 *
 * The query is caught rather than allowed to throw. Every other search path in
 * the codebase already degrades this way — `searchKindSafely` hands back an
 * `unavailable` set, /groups renders a note when its query errors — and a page
 * that is the only one to take the whole route down when search has a bad day
 * is the page that will be reported as broken. Browse and search fail
 * separately here for the same reason they are separate queries: a full-text
 * failure says nothing about whether the calendar can still be listed, so a
 * failed search still offers the browse that would have worked.
 */
async function EventResults({ term }: { term: string }) {
  let events;
  try {
    events = term
      ? await searchUpcomingEvents({ term, limit: EVENT_LIMIT })
      : await getUpcomingEvents({ limit: EVENT_LIMIT });
  } catch (error) {
    console.error('Events page query error:', error);
    return <EventsUnavailable searching={Boolean(term)} />;
  }

  if (events.length === 0) return <EmptyEvents term={term} />;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard
          key={event.id}
          slug={event.slug}
          title={event.title}
          description={event.description}
          coverImage={event.coverImage}
          coverImageAlt={event.coverImageAlt}
          startsAt={event.startsAt.toISOString()}
          timezone={event.timezone}
          mode={event.mode}
          attendeeCount={event.attendeeCount}
          attendeeCap={event.attendeeCap}
          venue={event.venue}
        />
      ))}
    </div>
  );
}

/**
 * The query failed, which is not the same as nothing matching.
 *
 * Says so plainly rather than showing an empty calendar: "no upcoming events"
 * when the database is the thing that is unwell is a lie that sends people
 * away. When it was a search that failed, browsing is still worth offering —
 * it is a different query and may well answer.
 */
function EventsUnavailable({ searching }: { searching: boolean }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-dashed p-12 text-center"
    >
      <CalendarDays className="mx-auto mb-4 h-12 w-12 text-gray-400" />
      <h2 className="text-xl font-semibold">
        {searching ? 'Event search is not answering' : 'Events are not loading'}
      </h2>
      <p className="mt-2 text-gray-500">
        That is on us, not on your search. Try again in a moment.
      </p>
      {searching && (
        <Button asChild variant="outline" className="mt-4">
          <Link href="/e">Browse all events</Link>
        </Button>
      )}
    </div>
  );
}

/**
 * Nothing to show.
 *
 * Two different situations wearing one layout. An empty calendar is an
 * invitation to host; an empty search is a wrong turn, and offering "host an
 * event" to someone who typed "cumbia" answers a question they did not ask.
 */
function EmptyEvents({ term }: { term: string }) {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <CalendarDays className="mx-auto mb-4 h-12 w-12 text-gray-400" />

      {term ? (
        <>
          <h2 className="text-xl font-semibold">No events matched</h2>
          <p className="mt-2 text-gray-500">
            Nothing upcoming for &ldquo;{term}&rdquo;. Try fewer words, or
            browse everything coming up.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/e">Browse all events</Link>
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold">No upcoming events</h2>
          <p className="mt-2 text-gray-500">
            Be the first to host a community event.
          </p>
          <Button asChild className="mt-4">
            <Link href="/e/new">Host an Event</Link>
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * What stands in for the grid while the query runs.
 *
 * Shaped like the thing it replaces rather than a spinner, so the page does
 * not change height and shove the search box up the screen the moment the real
 * cards land.
 */
function ResultsSkeleton() {
  return (
    <>
      {/* One live region for the whole block. The pulsing boxes are decoration
          and are hidden — a screen reader announcing six empty cards is worse
          than it announcing nothing. */}
      <p role="status" className="sr-only">
        Loading events
      </p>

      <div
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        aria-hidden="true"
      >
        {Array.from({ length: SKELETON_CARDS }).map((_, card) => (
          <div
            key={card}
            className="bg-pana-ink/[0.06] h-72 animate-pulse rounded-xl"
          />
        ))}
      </div>
    </>
  );
}
