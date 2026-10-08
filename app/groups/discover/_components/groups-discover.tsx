'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import {
  GROUP_SORTS,
  useGroupSearch,
  useGroupTopics,
  useMyGroups,
  parseGroupSortId,
} from '@/lib/query/social';
import { GroupCard, TopicChip } from '@/app/groups/_components/group-cards';

/** How long a keystroke waits before it becomes a request. */
const SEARCH_DEBOUNCE_MS = 250;

/** Mirrors the server's page size, so the heading can tell a full page apart. */
const PAGE_SIZE = 24;

/**
 * The body of /groups/discover.
 *
 * Everything the landing page deliberately does not do: a real search field
 * that searches, topic filtering that narrows, sorting, counts, and an empty
 * state. Splitting it out is what lets the landing page stay a landing page.
 *
 * Three things this page settles:
 *
 *   1. Sort defaults to activity, not size. Sorted by size, new groups are
 *      invisible forever, and a browse page that only shows the ten biggest
 *      groups cannot grow an eleventh.
 *   2. Private groups stay listed. A request-to-join group has to be findable
 *      or it can never be asked. What is hidden is what is inside it, which
 *      the server withholds rather than the card.
 *   3. Filters are visible rather than behind a control. One row of chips and
 *      one row of sort buttons; anything that needs a filter drawer on a list
 *      this size is a list that needs better defaults.
 *
 * All three controls live in the URL rather than in state alone, so a
 * narrowed list can be linked, bookmarked and reached by the Back button --
 * and so the landing page's chips can deep-link straight into one.
 */
export function GroupsDiscoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlTerm = searchParams?.get('q') ?? '';
  const topic = searchParams?.get('topic') || null;
  const sort = parseGroupSortId(searchParams?.get('sort'));

  const { data: session, status } = useSession();
  const signedIn = status !== 'loading' && !!session;

  /* The input is local so typing stays responsive, and the URL catches up on
     a debounce. Driving the input straight from the URL would re-render the
     whole page on every keystroke and fight the cursor. */
  const [draft, setDraft] = useState(urlTerm);

  /* Only follows the URL when it changes underneath us -- a chip click, a
     Back button -- not on every render, which would undo typing. */
  useEffect(() => {
    setDraft(urlTerm);
  }, [urlTerm]);

  useEffect(() => {
    if (draft.trim() === urlTerm.trim()) return;
    const timer = setTimeout(() => {
      updateParams({ q: draft.trim() || null });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    /* `updateParams` is recreated every render, so depending on it would
       re-arm the timer every render and the debounce would never fire. It
       closes over `searchParams`, which `urlTerm` already tracks. */
  }, [draft, urlTerm]);

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    /* replace, not push: every keystroke would otherwise be a history entry,
       and Back would walk letter by letter out of the search. */
    router.replace(query ? `/groups/discover?${query}` : '/groups/discover');
  }

  const { data, isLoading } = useGroupSearch(urlTerm, sort, topic);
  const { data: topicData } = useGroupTopics();
  const { data: mine } = useMyGroups({ enabled: signedIn });

  const topics = topicData?.topics ?? [];
  const groups = data?.groups ?? [];

  /* Derived once for the whole list rather than per card. */
  const joined = new Set((mine?.groups ?? []).map((group) => group.id));

  const filtered = urlTerm.trim().length > 0 || topic !== null;

  return (
    <div>
      <header>
        {/* Hidden at `lg`, where the rail's Groups item does this job and two
            ways back to the same page a thumb-width apart is just noise. The
            mobile strip carries no nav, so below `lg` this is the only way
            back and has to stay. */}
        <Link
          href="/groups"
          className="text-pana-ink/55 hover:text-pana-indigo inline-flex items-center gap-1.5 text-[13px] font-extrabold transition-colors lg:hidden"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Groups
        </Link>

        <h1 className="text-pana-ink mt-2 text-2xl font-extrabold lg:mt-0">
          Discover groups
        </h1>
        <p className="text-pana-ink/65 mt-0.5 text-[14px] font-medium">
          Search by name or interest, or just look around.
        </p>
      </header>

      {/* Sticky because the filters are the page. Scrolling results away from
          the controls that produced them is how somebody loses track of what
          they have narrowed to. */}
      <div className="bg-pana-cream/95 sticky top-0 z-10 -mx-4 mt-5 px-4 py-3 backdrop-blur">
        <div className="border-pana-ink/14 focus-within:border-pana-indigo flex items-center gap-2.5 rounded-full border-2 bg-white px-4 py-2.5 transition-colors">
          <Search
            className="text-pana-ink/40 h-4 w-4 flex-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search groups"
            aria-label="Search groups"
            className="text-pana-ink placeholder:text-pana-ink/40 min-w-0 flex-1 bg-transparent text-[14px] font-bold outline-none"
          />
          {draft && (
            <button
              type="button"
              onClick={() => setDraft('')}
              aria-label="Clear search"
              className="text-pana-ink/40 hover:text-pana-ink flex-none"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-pana-ink/45 inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.1em] uppercase">
            <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
            Sort
          </span>

          {GROUP_SORTS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => updateParams({ sort: option.id })}
              aria-pressed={sort === option.id}
              className={
                sort === option.id
                  ? 'border-pana-ink bg-pana-ink rounded-full border-2 px-3 py-1 text-[12px] font-extrabold text-white'
                  : 'border-pana-ink/14 text-pana-ink/65 hover:border-pana-indigo rounded-full border-2 bg-white px-3 py-1 text-[12px] font-extrabold transition-colors'
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* The same chips as the landing page, reading the same counts, but
          here they narrow in place rather than navigate. */}
      {topics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {topic && (
            <button
              type="button"
              onClick={() => updateParams({ topic: null })}
              className="border-pana-ink/14 text-pana-ink/60 hover:border-pana-indigo inline-flex items-center gap-1.5 rounded-full border-2 bg-white px-3.5 py-1.5 text-[13px] font-extrabold transition-colors"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          )}

          {topics.map(({ topic: entry, count }) => (
            <TopicChip
              key={entry}
              topic={entry}
              count={count}
              active={topic === entry}
              onSelect={() =>
                updateParams({ topic: topic === entry ? null : entry })
              }
            />
          ))}
        </div>
      )}

      <div className="mt-7">
        {isLoading ? (
          <div className="animate-pulse space-y-3" aria-hidden="true">
            <div className="bg-pana-ink/10 h-5 w-28 rounded-lg" />
            <div className="bg-pana-ink/10 h-40 rounded-2xl" />
            <div className="bg-pana-ink/10 h-40 rounded-2xl" />
          </div>
        ) : (
          <>
            <h2 className="text-pana-ink text-[15px] font-extrabold">
              {/* Counted off the rendered array rather than a separate total,
                  so the heading and the cards below it can never disagree. A
                  full page gets a "+" instead of a number it cannot back up:
                  the server returns one page and does not say how many more
                  there are. */}
              {groups.length}
              {groups.length === PAGE_SIZE ? '+' : ''}{' '}
              {groups.length === 1 ? 'group' : 'groups'}
              {filtered ? '' : ' on Pana'}
            </h2>

            {groups.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {groups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    joined={joined.has(group.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyResults term={urlTerm} />
            )}
          </>
        )}
      </div>

      {!signedIn && groups.length > 0 && (
        <p className="text-pana-ink/50 mt-6 text-center text-[13px] font-bold">
          Browsing is open to everyone. Joining needs an account.
        </p>
      )}
    </div>
  );
}

/**
 * Nothing matched.
 *
 * Offers starting a group, because on a browse page "no results" and "nobody
 * has made this yet" are the same fact, and the second one is actionable. The
 * term is echoed back so it is obvious what was searched -- an empty state
 * that does not repeat the query leaves people wondering whether it ran.
 */
function EmptyResults({ term }: { term: string }) {
  const trimmed = term.trim();

  return (
    <div className="reserved-slot mt-4 items-start p-7">
      <p className="reserved-slot-title">
        {trimmed
          ? `No groups matching "${trimmed}"`
          : 'No groups match these filters'}
      </p>
      <p className="text-pana-ink/70 max-w-prose text-[14px] leading-relaxed font-medium">
        Nobody has started this one yet. That is usually the real answer on a
        site this size, and it is a better one than a list of near misses.
      </p>

      <Link
        href={
          trimmed
            ? `/groups/new?name=${encodeURIComponent(trimmed)}`
            : '/groups/new'
        }
        className="bg-pana-ink mt-1 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-extrabold text-white"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Start {trimmed ? `"${trimmed}"` : 'a group'}
      </Link>
    </div>
  );
}
