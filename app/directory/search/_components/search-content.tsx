'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useSearch, type DirectorySort } from '@/lib/query/directory';
import { forceInt } from '@/lib/standardized';
import { searchPath } from '@/lib/directory-search-path';
import { useViewerLocation } from '@/app/p/[user]/_lib/use-viewer-location';
import { DirectoryViewerProvider } from './directory-viewer';
import { SearchBand } from './search-band';
import { FilterBar, type FilterState, type ResultView } from './filter-bar';
import { ResultCard } from './result-card';
import { MapPanel } from './map-panel';
import { EmptyState } from './empty-state';
import { SearchPagination } from './search-pagination';

const SORTS: DirectorySort[] = ['relevance', 'nearest', 'recommended', 'name'];

function toSort(raw: string | null): DirectorySort {
  return SORTS.includes(raw as DirectorySort)
    ? (raw as DirectorySort)
    : 'relevance';
}

/** `a+b+c` is the directory's existing multi-value encoding. Kept as-is. */
function splitList(raw: string): string[] {
  return raw ? raw.split('+').filter(Boolean) : [];
}

function getSearchParams(searchParams: URLSearchParams, pathTerm?: string) {
  const pageNum = forceInt(searchParams.get('p') || '', 1);
  const pageLimit = forceInt(searchParams.get('l') || '', 20);
  // A term in the path wins over ?q=. Both forms stay readable so existing
  // links and bookmarks keep working; the path form is the canonical one.
  const searchTerm = pathTerm || searchParams.get('q') || '';
  const random = forceInt(searchParams.get('random') || '', 0);
  const filterLocations = searchParams.get('floc') || '';
  const filterCategories = searchParams.get('fcat') || '';
  const mentorsOnly = searchParams.get('mentors') === 'true';
  const expertise = searchParams.get('expertise') || '';
  const languages = searchParams.get('lang') || '';
  const freeOnly = searchParams.get('free') === 'true';

  return {
    pageNum,
    pageLimit,
    searchTerm,
    filterLocations,
    filterCategories,
    random,
    mentorsOnly,
    expertise,
    languages,
    freeOnly,
    sort: toSort(searchParams.get('sort')),
    certifiedOnly: searchParams.get('certified') === 'true',
    withEventsOnly: searchParams.get('events') === 'true',
    view: (searchParams.get('view') === 'map' ? 'map' : 'list') as ResultView,
  };
}

interface DirectorySearchContentProps {
  /** Search term taken from the /directory/search/<term> path segment. */
  initialTerm?: string;
}

export function DirectorySearchContent({
  initialTerm,
}: DirectorySearchContentProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = getSearchParams(
    searchParams || new URLSearchParams(),
    initialTerm
  );

  // Precise coordinates, held in the browser and never sent anywhere. Only a
  // 2dp version reaches the server, and only to order results — see
  // searchParamsToString.
  const { coords, status: locationStatus, request } = useViewerLocation();
  const locationShared = coords !== null;

  // Nearest with nothing to measure from is not a sort, it is a label over an
  // arbitrary order. If a shared location goes away — an expired cache, or a
  // link someone else sent — fall back rather than keep the claim.
  const sort: DirectorySort =
    params.sort === 'nearest' && !locationShared ? 'relevance' : params.sort;

  const { data: searchResult, isLoading } = useSearch({
    ...params,
    sort,
    geolat: coords?.lat ?? 0,
    geolng: coords?.lng ?? 0,
  });

  const results = useMemo(() => searchResult?.data ?? [], [searchResult]);
  const totalResults = searchResult?.pagination?.total ?? 0;
  const totalPages = searchResult?.pagination?.totalPages ?? 1;

  const profileIds = useMemo(
    () => results.map((result) => result._id),
    [results]
  );

  /**
   * Filters and pagination stay in the query string — only the term lives in
   * the path — so every navigation rebuilds the term's path and carries the
   * rest across as params. `q` is dropped on the way: keeping it would leave
   * two copies of the term in one URL, free to disagree.
   */
  const pushSearch = useCallback(
    (term: string, nextParams: URLSearchParams) => {
      nextParams.delete('q');
      const qs = nextParams.toString();
      router.push(`${searchPath(term)}${qs ? `?${qs}` : ''}`);
    },
    [router]
  );

  /** Change some keys, keeping every key this page does not own. */
  const patch = useCallback(
    (changes: Record<string, string | null>, term = params.searchTerm) => {
      const next = new URLSearchParams(searchParams?.toString() || '');
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      pushSearch(term, next);
    },
    [params.searchTerm, pushSearch, searchParams]
  );

  // Drop a stale "nearest" out of the URL too, so the select and the address
  // bar do not disagree about what the page is doing.
  useEffect(() => {
    if (params.sort === 'nearest' && locationStatus === 'denied') {
      patch({ sort: null });
    }
  }, [params.sort, locationStatus, patch]);

  const filters: FilterState = {
    categories: splitList(params.filterCategories),
    counties: splitList(params.filterLocations),
    certifiedOnly: params.certifiedOnly,
    withEventsOnly: params.withEventsOnly,
    sort,
  };

  const applyFilters = (next: FilterState) => {
    patch({
      fcat: next.categories.join('+') || null,
      floc: next.counties.join('+') || null,
      certified: next.certifiedOnly ? 'true' : null,
      events: next.withEventsOnly ? 'true' : null,
      sort: next.sort === 'relevance' ? null : next.sort,
      // Any change to what is being asked invalidates which page you were on.
      p: null,
    });
  };

  const handleSearch = (term: string) => {
    // A new term resets pagination and filters; stale filters would silently
    // narrow a search the visitor thinks is fresh.
    pushSearch(term, new URLSearchParams());
  };

  const showEmpty = !isLoading && results.length === 0;

  return (
    <DirectoryViewerProvider profileIds={profileIds}>
      <main className="dirsearch">
        <SearchBand
          term={params.searchTerm}
          resultCount={results.length}
          totalCount={totalResults}
          loading={isLoading}
          locationStatus={locationStatus}
          nearestFirst={sort === 'nearest'}
          onSearch={handleSearch}
          onShareLocation={request}
        />

        <FilterBar
          filters={filters}
          onChange={applyFilters}
          view={params.view}
          onViewChange={(next) =>
            patch({ view: next === 'map' ? 'map' : null })
          }
          locationShared={locationShared}
        />

        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="dirsearch-results">
              <ul className="dirsearch-grid" aria-busy="true">
                {[0, 1, 2].map((index) => (
                  <li key={index} className="dirsearch-skeleton" />
                ))}
              </ul>
            </div>
          ) : showEmpty ? (
            <EmptyState
              term={params.searchTerm}
              filters={filters}
              onChange={applyFilters}
              onTermChange={handleSearch}
            />
          ) : params.view === 'map' ? (
            <div className="dirsearch-results">
              <MapPanel results={results} viewerCoords={coords} />
            </div>
          ) : (
            <div className="dirsearch-results">
              <ul className="dirsearch-grid">
                {results.map((result) => (
                  <li key={result._id}>
                    <ResultCard result={result} viewerCoords={coords} />
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <SearchPagination
                  currentPage={params.pageNum}
                  totalPages={totalPages}
                  totalResults={totalResults}
                  onPageChange={(page) => patch({ p: page.toString() })}
                />
              )}
            </div>
          )}

          {/* The two standing invitations the old page buried among four
              stacked cards. Kept, but once each, and after the results rather
              than competing with them. */}
          <aside className="dirsearch-cta">
            <div>
              <h2>Not listed yet?</h2>
              <p>
                A listing is how South Florida finds you — free, and yours to
                run.
              </p>
              <Link href="/form/list-your-business" className="link-arrow">
                List your business
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div>
              <h2>Missing someone?</h2>
              <p>
                Tell us about a local spot you love and we will reach out to
                them.
              </p>
              <Link href="/form/contact-us" className="link-arrow">
                Send a recommendation
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </DirectoryViewerProvider>
  );
}
