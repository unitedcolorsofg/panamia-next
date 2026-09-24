'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Crosshair, MapPin, Search } from 'lucide-react';
import type { LocationStatus } from '@/app/p/[user]/_lib/use-viewer-location';
import { COUNTY_FILTER_ID } from './filter-bar';

interface SearchBandProps {
  term: string;
  resultCount: number;
  totalCount: number;
  loading: boolean;
  locationStatus: LocationStatus;
  /** True only when the active sort is distance-based. */
  nearestFirst: boolean;
  onSearch: (term: string) => void;
  onShareLocation: () => void;
}

/**
 * The top of the results column.
 *
 * Three jobs, in order of how often they matter:
 *
 * 1. Say what was searched, and let it be changed without going back. The page
 *    this replaces dropped the term into a small input inside a white card and
 *    never repeated it, so a search that went wrong looked the same as one
 *    that found nothing.
 * 2. Say how many results there are, in words, before the list starts.
 * 3. Offer location. This is the one control that turns a list of businesses
 *    into a list of businesses you can actually get to, so it sits in the
 *    header rather than behind a filter dialog where it would never be found.
 *
 * All three now fit in roughly the height of the search box itself. This used
 * to be a hero: an eyebrow, a display-sized headline, a count, the box, the
 * location row, and a full-bleed drawing of a town — around 570px before the
 * first result. That is a fine way to open a page you arrive on once and a bad
 * way to open one you refine five times in a row. With the map now holding the
 * right half of the screen, height taken here is height taken from the
 * results rather than from empty space, so the headline and the count became
 * one sentence, the scenery went, and what is left is a toolbar.
 *
 * The window does not scroll on this page, so nothing here can be scrolled
 * away from. That is the other reason it has to be small.
 */
export function SearchBand({
  term,
  resultCount,
  totalCount,
  loading,
  locationStatus,
  nearestFirst,
  onSearch,
  onShareLocation,
}: SearchBandProps) {
  const [draft, setDraft] = useState(term);

  // The term can change without this input: from the empty state's "browse
  // everything", from a category chip, or from the back button. Left alone,
  // the field would keep showing a search the page is no longer running.
  useEffect(() => setDraft(term), [term]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(draft.trim());
  };

  const shared = locationStatus === 'granted';

  return (
    <section className="dirsearch-tools">
      <form onSubmit={handleSubmit} className="dirsearch-searchrow">
        <label htmlFor="dirsearch-input" className="sr-only">
          Search the Pana Mia directory
        </label>
        <div className="dirsearch-pill">
          <Search className="h-5 w-5 shrink-0 opacity-45" aria-hidden="true" />
          <input
            id="dirsearch-input"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Try food, art, Hialeah, bike repair…"
            autoComplete="off"
          />
          <button type="submit">Search</button>
        </div>
      </form>

      <div className="dirsearch-toolsline">
        {/* The page's heading is the page's heading, not its result count.
            This h1 used to be the big "Find your people" hero line; the hero
            is gone but the stable, route-describing heading it carried still
            has to exist for screen readers and crawlers. Hiding it visually
            keeps that contract at zero vertical cost. */}
        <h1 className="sr-only">Find your people</h1>

        {/* Headline and count in one sentence. Two lines of type that each
            said half of "24 results for food" cost more height than they
            earned. It's a status message, not a heading — it says what the
            search is doing right now, so it announces itself when the answer
            changes instead of silently rewriting the page title. */}
        <p className="dirsearch-summary" role="status" aria-live="polite">
          {loading ? (
            <>Searching…</>
          ) : resultCount === 0 ? (
            <>
              No matches
              {term ? (
                <>
                  {' '}
                  for <em>{term}</em>
                </>
              ) : null}{' '}
              yet — try a broader search
            </>
          ) : (
            <>
              <strong>{resultCount}</strong>
              {resultCount === totalCount ? ' businesses' : ` of ${totalCount}`}
              {term ? (
                <>
                  {' '}
                  for <em>{term}</em>
                </>
              ) : null}{' '}
              in South Florida
              {/* Only claim an ordering the page is actually using. Saying
                  "closest first" under Best match is the kind of small lie
                  that makes people stop trusting the sort. */}
              {shared &&
                (nearestFirst ? ', closest first' : ', with distances')}
            </>
          )}
        </p>

        {/* The local-first control. One sentence and one button rather than a
            permissions-style dialog, because the honest ask is small: we want
            to sort a list, and the coordinates never leave the browser. */}
        <div className="dirsearch-locbar">
          {shared ? (
            <>
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Distances from <strong>your location</strong>
              </span>
            </>
          ) : locationStatus === 'denied' ? (
            <>
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              {/* Not a dead end. A declined permission is sticky and usually
                  deliberate, so "turn it on in your browser" is advice most
                  people will not take and some cannot. The county chips answer
                  the same question — what is near me — and need no permission
                  at all, so that is the offer worth leading with. */}
              <span>Location is off, so distances are hidden.</span>
              <a className="dirsearch-locshare" href={`#${COUNTY_FILTER_ID}`}>
                Pick a county
              </a>
            </>
          ) : (
            <>
              <Crosshair className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>See what is closest to you</span>
              <button
                type="button"
                className="dirsearch-locshare"
                disabled={locationStatus === 'asking'}
                onClick={onShareLocation}
              >
                {locationStatus === 'asking' ? 'Locating…' : 'Use my location'}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
