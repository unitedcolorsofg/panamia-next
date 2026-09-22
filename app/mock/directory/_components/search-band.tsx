'use client';

import { type FormEvent, useState } from 'react';
import { Crosshair, MapPin, Search } from 'lucide-react';

interface SearchBandProps {
  term: string;
  resultCount: number;
  totalCount: number;
  locationShared: boolean;
  /** True only when the active sort is distance-based. */
  nearestFirst: boolean;
  /** Human-readable stand-in for the viewer's position. */
  viewerPlace: string;
  onSearch: (term: string) => void;
  onShareLocation: () => void;
}

/**
 * The top of the results page.
 *
 * Three jobs, in order of how often they matter:
 *
 * 1. Say what was searched, and let it be changed without going back. The
 *    current page drops the term into a small input inside a white card and
 *    never repeats it, so a search that went wrong looks the same as one that
 *    found nothing.
 * 2. Say how many results there are, in words, before the list starts.
 * 3. Offer location. This is the one control that turns a list of businesses
 *    into a list of businesses you can actually get to, so it sits in the
 *    header rather than behind the filter dialog where it would never be
 *    found.
 */
export function SearchBand({
  term,
  resultCount,
  totalCount,
  locationShared,
  nearestFirst,
  viewerPlace,
  onSearch,
  onShareLocation,
}: SearchBandProps) {
  const [draft, setDraft] = useState(term);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(draft);
  };

  return (
    <section className="surface-indigo dirsearch-band">
      <div className="container mx-auto px-4">
        <span className="section-eyebrow">Directory</span>

        <h1 className="dirsearch-title">
          {term ? (
            <>
              <em>{term}</em> in South Florida
            </>
          ) : (
            <>Find your people</>
          )}
        </h1>

        <p className="dirsearch-count">
          {resultCount === 0 ? (
            <>No matches yet — try a broader search</>
          ) : (
            <>
              <strong>{resultCount}</strong>
              {resultCount === totalCount
                ? ' local businesses'
                : ` of ${totalCount} local businesses`}
              {/* Only claim an ordering the page is actually using. Saying
                  "sorted by how close they are" under Best match is the kind
                  of small lie that makes people stop trusting the sort. */}
              {locationShared &&
                (nearestFirst
                  ? ', closest first'
                  : `, with distances from ${viewerPlace}`)}
            </>
          )}
        </p>

        <form onSubmit={handleSubmit} className="dirsearch-searchrow">
          <label htmlFor="dirsearch-input" className="sr-only">
            Search the Pana Mia directory
          </label>
          <div className="dirsearch-pill">
            <Search
              className="h-5 w-5 shrink-0 opacity-45"
              aria-hidden="true"
            />
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

        {/* The local-first control. Kept as a single sentence with one button
            rather than a permissions-style dialog, because the honest ask is
            small: we want to sort a list, not track anyone. */}
        <div className="dirsearch-locbar">
          {locationShared ? (
            <>
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Measuring from <strong>{viewerPlace}</strong>
              </span>
              <button type="button" className="dirsearch-locchange">
                Change
              </button>
            </>
          ) : (
            <>
              <Crosshair className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Share your location to see what is closest to you</span>
              <button
                type="button"
                className="dirsearch-locshare"
                onClick={onShareLocation}
              >
                Use my location
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
