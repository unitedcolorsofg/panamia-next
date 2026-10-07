'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import {
  GROUP_SORTS,
  searchGroups,
  sortGroups,
  topicsWithCounts,
  type GroupSort,
  type ViewerAuth,
} from '../_data/mock-groups';
import { GroupCard, TopicChip } from './group-cards';

/**
 * The proposed /groups/discover page.
 *
 * Everything the landing page deliberately does not do: a real search field
 * that searches, topic filtering that narrows, sorting, counts, and an empty
 * state. Splitting it out is what lets the landing page stay a landing page
 * -- today both jobs share one screen and searching pushes the browse list
 * around underneath the box.
 *
 * Three things this page is trying to settle:
 *
 *   1. Sort defaults to activity, not size. The fixtures include a six-member
 *      group precisely to test this: sorted by size, new groups are invisible
 *      forever, and a browse page that only shows the ten biggest groups
 *      cannot grow an eleventh.
 *   2. Private groups stay listed. A request-to-join group has to be findable
 *      or it can never be asked. What is hidden is what is inside it, and the
 *      card is what enforces that.
 *   3. Filters are visible rather than behind a control. One row of chips and
 *      one row of sort buttons; anything that needs a filter drawer on a list
 *      this size is a list that needs better defaults.
 */
export function GroupsDiscover({
  viewer,
  initialTopic,
  onBack,
}: {
  viewer: ViewerAuth;
  initialTopic: string | null;
  onBack: () => void;
}) {
  const [term, setTerm] = useState('');
  const [topic, setTopic] = useState<string | null>(initialTopic);
  const [sort, setSort] = useState<GroupSort>('active');

  const topics = topicsWithCounts();

  /* One pipeline, so the count in the heading and the cards below it are the
     same array. Writing the heading from a separate count is how a page ends
     up saying "7 groups" above five cards. */
  const results = useMemo(
    () => sortGroups(searchGroups(term, topic), sort),
    [term, topic, sort]
  );

  const filtered = term.trim().length > 0 || topic !== null;

  return (
    <div className="container mx-auto max-w-5xl px-4 pt-8">
      <header>
        <button
          type="button"
          onClick={onBack}
          className="text-pana-ink/55 hover:text-pana-indigo inline-flex items-center gap-1.5 text-[13px] font-extrabold transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Groups
        </button>

        <h1 className="text-pana-ink mt-2 text-2xl font-extrabold">
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
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search groups"
            aria-label="Search groups"
            className="text-pana-ink placeholder:text-pana-ink/40 min-w-0 flex-1 bg-transparent text-[14px] font-bold outline-none"
          />
          {term && (
            <button
              type="button"
              onClick={() => setTerm('')}
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
              onClick={() => setSort(option.id)}
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
      <div className="mt-4 flex flex-wrap gap-2">
        {topic && (
          <button
            type="button"
            onClick={() => setTopic(null)}
            className="border-pana-ink/14 text-pana-ink/60 hover:border-pana-indigo inline-flex items-center gap-1.5 rounded-full border-2 bg-white px-3.5 py-1.5 text-[13px] font-extrabold transition-colors"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </button>
        )}

        {topics.map(({ topic: entry, count }) => (
          <TopicChip
            key={entry.id}
            topic={entry}
            count={count}
            active={topic === entry.id}
            onSelect={() => setTopic(topic === entry.id ? null : entry.id)}
          />
        ))}
      </div>

      <div className="mt-7">
        <h2 className="text-pana-ink text-[15px] font-extrabold">
          {/* Counted off the rendered array rather than a separate total. */}
          {results.length} {results.length === 1 ? 'group' : 'groups'}
          {filtered ? '' : ' on Pana'}
        </h2>

        {results.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {results.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        ) : (
          <EmptyResults term={term} />
        )}
      </div>

      {viewer === 'signedOut' && results.length > 0 && (
        <p className="text-pana-ink/50 mt-6 text-center text-[13px] font-bold">
          Browsing is open to everyone. Joining needs an account.
        </p>
      )}

      <p className="border-pana-ink/10 text-pana-ink/55 mt-14 border-t pt-6 text-[13px] font-bold">
        Design mock of <code>/groups/discover</code> at{' '}
        <code>/mock/groups</code>, with hardcoded data. Search matches name,
        handle, summary and topics -- the same four fields migration 0040 puts
        in the search vector -- so the mock does not promise fuzzy matching the
        backend cannot do.
      </p>
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
  return (
    <div className="reserved-slot mt-4 items-start p-7">
      <p className="reserved-slot-title">
        {term
          ? `No groups matching "${term}"`
          : 'No groups match these filters'}
      </p>
      <p className="text-pana-ink/70 max-w-prose text-[14px] leading-relaxed font-medium">
        Nobody has started this one yet. That is usually the real answer on a
        site this size, and it is a better one than a list of near misses.
      </p>

      <button
        type="button"
        className="bg-pana-ink mt-1 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-extrabold text-white"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Start {term ? `"${term}"` : 'a group'}
      </button>
    </div>
  );
}
