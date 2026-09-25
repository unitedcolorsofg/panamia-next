'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import SurfaceLink from '@/components/panaverse/SurfaceLink';
import { useGroupSearch } from '@/lib/query/social';
import { useSearch, type SearchResultsInterface } from '@/lib/query/directory';
import { GroupResultCard } from './group-result-card';

type SearchTab = 'panas' | 'groups';

const TABS: { id: SearchTab; label: string }[] = [
  { id: 'panas', label: 'Panas' },
  { id: 'groups', label: 'Groups' },
];

/** How many Panas this page shows before handing off to the directory. */
const PANA_PREVIEW_LIMIT = 6;

function isTab(value: string | null): value is SearchTab {
  return value === 'panas' || value === 'groups';
}

export function SocialSearchContent() {
  const searchParams = useSearchParams();

  const term = (searchParams?.get('q') ?? '').trim();
  const requested = searchParams?.get('tab') ?? null;
  const tab: SearchTab = isTab(requested) ? requested : 'panas';

  return (
    <div className="space-y-5">
      <SearchField term={term} tab={tab} />

      {/* Links rather than buttons: a tab is a different URL here, so the
          back button steps between them and a result set can be shared with
          the tab it was read on. */}
      <div className="profile-tabs" role="tablist" aria-label="Search results">
        {TABS.map((entry) => {
          const isActive = entry.id === tab;
          return (
            <Link
              key={entry.id}
              role="tab"
              aria-selected={isActive}
              href={`/search?q=${encodeURIComponent(term)}&tab=${entry.id}`}
              className="profile-tab"
              data-active={isActive}
            >
              {entry.label}
            </Link>
          );
        })}
      </div>

      {/* Only the open tab is mounted, so a search costs one request instead
          of two. That is also why the tabs carry no result counts: a count
          for the closed tab would mean fetching it anyway. */}
      {tab === 'groups' ? (
        <GroupResults term={term} />
      ) : (
        <PanaResults term={term} />
      )}
    </div>
  );
}

/**
 * The page's own search field.
 *
 * Not redundant with the masthead: `SurfaceGuestHeader` carries no search, so
 * a signed-out visitor who lands here from a shared link would otherwise have
 * no way to search again. A plain GET form for the same reason the masthead
 * one is -- it works before the bundle lands.
 */
function SearchField({ term, tab }: { term: string; tab: SearchTab }) {
  return (
    <form role="search" action="/search" method="get" className="flex gap-2">
      <label htmlFor="social-search-input" className="sr-only">
        Search Pana Social
      </label>
      <div className="relative flex-1">
        <Search
          className="text-pana-ink/40 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          id="social-search-input"
          type="search"
          name="q"
          defaultValue={term}
          placeholder="Search Panas and groups"
          autoComplete="off"
          className="border-pana-ink/12 focus:border-pana-orange/55 focus:ring-pana-orange/18 w-full rounded-full border bg-white py-2 pr-4 pl-9 text-sm font-medium focus:ring-2 focus:outline-none"
        />
      </div>
      {/* Carries the open tab through the submit, so re-searching from the
          Groups tab does not silently drop the member back on Panas. */}
      <input type="hidden" name="tab" value={tab} />
      <button
        type="submit"
        className="bg-pana-ink rounded-full px-5 text-sm font-extrabold text-white"
      >
        Search
      </button>
    </form>
  );
}

function GroupResults({ term }: { term: string }) {
  const { data, isLoading, isError } = useGroupSearch(term);
  const groups = data?.groups ?? [];

  if (isLoading) return <ResultsSkeleton />;
  if (isError) {
    return (
      <ResultsNote
        title="Group search is not answering"
        body="That is on us, not on your search. Try again in a moment."
      />
    );
  }

  if (groups.length === 0) {
    return term ? (
      <ResultsNote
        title={`No groups match "${term}"`}
        body="Group search covers names, topics and descriptions, and already tries near-misses before giving up. Nothing here yet means nobody has started this one."
      />
    ) : (
      <ResultsNote
        title="No groups yet"
        body="Nobody has started a group on Pana Social. The first one is yours to make."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* An empty term is a browse, not a failed search, and saying so is what
          keeps the tab worth opening cold. */}
      {!term && (
        <p className="feed-context">Groups with the most members right now</p>
      )}
      {groups.map((group) => (
        <GroupResultCard key={group.id} group={group} />
      ))}
    </div>
  );
}

function PanaResults({ term }: { term: string }) {
  if (!term) {
    return (
      <ResultsNote
        title="Type a name to find a Pana"
        body="Panas are searched by name, what they do and where they are. Groups can be browsed without typing anything -- try the Groups tab."
      />
    );
  }
  return <PanaResultsList term={term} />;
}

/* Split so the hook never runs with an empty term: the directory endpoint
   treats a termless search as a browse and needs a random seed this page has
   no reason to mint. Mounting conditionally is the clean version of that;
   calling the hook conditionally is not allowed. */
function PanaResultsList({ term }: { term: string }) {
  const { data, isLoading, isError } = useSearch({
    pageNum: 1,
    pageLimit: PANA_PREVIEW_LIMIT,
    searchTerm: term,
    filterLocations: '',
    filterCategories: '',
    random: 0,
    geolat: 0,
    geolng: 0,
    sort: 'relevance',
  });

  if (isLoading) return <ResultsSkeleton />;
  if (isError || data?.success === false) {
    return (
      <ResultsNote
        title="Pana search is not answering"
        body="That is on us, not on your search. Try again in a moment."
      />
    );
  }

  const results = data?.data ?? [];
  const total = data?.pagination?.total ?? results.length;

  if (results.length === 0) {
    return (
      <ResultsNote
        title={`No Panas match "${term}"`}
        body="Try a shorter term, or look for a group instead."
      />
    );
  }

  return (
    <div className="space-y-3">
      {results.map((pana) => (
        <PanaResultCard key={pana._id} pana={pana} />
      ))}

      {/* The directory owns filters, distance and the map. This page shows
          enough to answer "is this person here?" and hands off rather than
          reimplementing any of that. */}
      {total > results.length && (
        <SurfaceLink
          href={`/directory/search/${encodeURIComponent(term)}`}
          className="link-arrow text-pana-indigo inline-flex items-center gap-1.5 text-[13px] font-extrabold"
        >
          See all {total} in the directory
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </SurfaceLink>
      )}
    </div>
  );
}

function PanaResultCard({ pana }: { pana: SearchResultsInterface }) {
  const location = pana.primary_address?.city;
  const blurb = pana.five_words;
  const image = pana.images?.primaryCDN;

  /* An unclaimed listing has no handle and therefore no profile page. Linking
     it would be a 404, so it renders as a plain card instead. */
  const href = pana.screenname ? `/p/${pana.screenname}` : null;

  const body = (
    <>
      {/* Remote CDN URLs, and next.config.js declares no remotePatterns, so
          the optimizer would reject these at runtime. Same call the directory
          card and the feed modules make. */}
      <img
        src={image || '/img/bg_coconut_blue.jpg'}
        alt=""
        aria-hidden="true"
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="text-pana-ink block truncate text-[15px] font-extrabold">
          {pana.name}
        </span>
        {(blurb || location) && (
          <span className="text-pana-ink/65 block truncate text-[13px] font-medium">
            {[blurb, location].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
    </>
  );

  const className =
    'border-pana-ink/10 flex items-center gap-3 rounded-2xl border bg-white p-4';

  if (!href) {
    return <div className={className}>{body}</div>;
  }

  return (
    <SurfaceLink
      href={href}
      className={`${className} hover:border-pana-ink/25 transition-colors`}
    >
      {body}
    </SurfaceLink>
  );
}

function ResultsSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden="true">
      <div className="bg-pana-ink/10 h-20 rounded-2xl" />
      <div className="bg-pana-ink/10 h-20 rounded-2xl" />
      <div className="bg-pana-ink/10 h-20 rounded-2xl" />
    </div>
  );
}

/* A solid card, matching the result cards. Deliberately not `.reserved-slot`:
   that style is a dashed placeholder meaning "content is coming here later",
   which would read as the feature being unfinished rather than the search
   having no answer. */
function ResultsNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-pana-ink/10 space-y-1.5 rounded-2xl border bg-white p-6">
      <p className="text-pana-ink text-[15px] font-extrabold">{title}</p>
      <p className="text-pana-ink/65 text-[13px] leading-snug font-medium">
        {body}
      </p>
    </div>
  );
}
