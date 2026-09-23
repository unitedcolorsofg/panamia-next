'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PanaGateProvider } from '../business-profile/_components/pana-gate';
import {
  MockControls,
  type DirectoryMockState,
} from './_components/mock-controls';
import { SearchBand } from './_components/search-band';
import { FilterBar, type ResultView } from './_components/filter-bar';
import { ResultCard } from './_components/result-card';
import { MapPanel } from './_components/map-panel';
import { EmptyState } from './_components/empty-state';
import {
  directoryResults,
  MOCK_VIEWER_COORDS,
  runQuery,
  type QueryState,
} from './_data';

/**
 * Design mock for the directory search results page.
 *
 * Route: /mock/directory
 *
 * This is the screen a pana lands on after typing into the homepage hero, and
 * it is where the directory either works or doesn't. Today it renders a
 * vertical stack of near-identical white cards — the same problem the profile
 * page had — with every filter hidden behind a dialog, no sense of distance
 * until you open a listing, and no signal about which businesses other panas
 * actually vouch for. Scanning it, you cannot tell one result from another.
 *
 * The redesign is built around one question, because it is the question
 * someone searching a *local* directory is really asking: which of these is
 * worth my afternoon, and can I get to it? So every card leads with identity
 * (logo, cover, name), then proximity, then the two things only this community
 * can tell you — how many panas recommend it, and whether it is Pana Certified
 * — and finally what is happening there soon.
 *
 * Reviewing notes:
 * - Search, filters, sort, and the list/map toggle are all live against the
 *   fixture in `_data.ts`. Use it like a visitor would.
 * - The mock bar switches viewer kind. Save is gated for signed-out visitors
 *   and hidden entirely for business accounts, matching the profile page.
 * - Recommend is deliberately absent from the card; see `result-card.tsx`.
 *
 * Nothing here touches the database. When the design is signed off, these
 * components move to `app/directory/search/_components/` against a widened
 * `SearchResultsInterface`, and `app/mock/` is deleted.
 */
export default function DirectoryMockPage() {
  const [mock, setMock] = useState<DirectoryMockState>({
    locationShared: true,
    viewer: 'anon',
  });

  const [query, setQuery] = useState<QueryState>({
    term: 'art',
    categories: [],
    counties: [],
    certifiedOnly: false,
    openToEvents: false,
    sort: 'relevance',
  });

  const [view, setView] = useState<ResultView>('list');

  const viewerCoords = mock.locationShared ? MOCK_VIEWER_COORDS : null;
  const entries = useMemo(
    () => runQuery(query, viewerCoords),
    [query, viewerCoords]
  );

  const activeFilterCount =
    query.categories.length +
    query.counties.length +
    (query.certifiedOnly ? 1 : 0) +
    (query.openToEvents ? 1 : 0);

  const handleMockChange = (next: DirectoryMockState) => {
    setMock(next);
    // Nearest becomes meaningless the moment there is nothing to measure
    // from, and silently leaving it selected would show an order the viewer
    // cannot account for.
    if (!next.locationShared && query.sort === 'nearest') {
      setQuery((prev) => ({ ...prev, sort: 'relevance' }));
    }
  };

  return (
    <PanaGateProvider
      viewer={mock.viewer}
      businessName="this business"
      businessLogo="/img/impact/partner-bohemian-kitchen.webp"
    >
      <MockControls state={mock} onChange={handleMockChange} />

      <SearchBand
        term={query.term}
        resultCount={entries.length}
        totalCount={directoryResults.length}
        locationShared={mock.locationShared}
        nearestFirst={query.sort === 'nearest'}
        viewerPlace="Wynwood"
        onSearch={(term) => setQuery((prev) => ({ ...prev, term }))}
        onShareLocation={() =>
          setMock((prev) => ({ ...prev, locationShared: true }))
        }
      />

      <FilterBar
        query={query}
        onChange={setQuery}
        view={view}
        onViewChange={setView}
        locationShared={mock.locationShared}
      />

      <section className="surface-cream dirsearch-results">
        <div className="container mx-auto px-4">
          {entries.length === 0 ? (
            <EmptyState
              query={query}
              activeFilterCount={activeFilterCount}
              onChange={setQuery}
            />
          ) : view === 'map' ? (
            <MapPanel
              entries={entries}
              locationShared={mock.locationShared}
              viewerPlace="Wynwood"
            />
          ) : (
            /* Deliberately not wrapped in ScrollReveal. That component hides
               [data-rv] until a scroll sweep reaches them, and this list
               re-renders on every filter click — results would blank out until
               the visitor happened to scroll. Reveal-on-scroll suits a page
               you read top to bottom, not one you interrogate. */
            <ul className="dirsearch-grid">
              {entries.map((entry) => (
                <li key={entry.result.id}>
                  <ResultCard
                    entry={entry}
                    locationShared={mock.locationShared}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* The directory is small, and a search that half-worked is the best
          moment to ask someone to add to it. */}
      <section className="surface-butter dirsearch-tail">
        <div className="container mx-auto px-4">
          <span className="section-eyebrow">Not finding them?</span>
          <h2 className="section-display">
            The directory grows when panas add to it
          </h2>
          <p className="section-lede">
            Every listing here was submitted by someone local. If the spot you
            love is missing, put them on the map.
          </p>
          <div className="dirsearch-tail-actions">
            <Link href="/join" className="dirsearch-tail-primary">
              Add a business
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/form/contact-us" className="link-arrow">
              Recommend one to us
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </PanaGateProvider>
  );
}
