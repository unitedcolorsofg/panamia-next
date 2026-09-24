'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Crosshair, MapPin, Search } from 'lucide-react';
import { SkyClouds, StreetScene } from '@/components/home/scene-art';
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
 * The top of the results page.
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
 * The surface underneath all three is the homepage's, not a band of its own.
 * This page used to open on a full-width indigo slab, which put a door
 * between the homepage and the screen it hands you to. Cream here means the
 * masthead, this header, the filters and the results read as one continuous
 * sheet — so the search box needs its own reason to be the first thing you
 * look at, and gets the homepage's pool of orange light behind it rather than
 * a colour change around it. The street is the same drawing the homepage ends
 * its first screen with, and is the strongest single cue that this is the same
 * place. Clouds and street are both `aria-hidden` and non-interactive; they
 * are scenery, and nothing here depends on them being seen.
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
    <section className="dirsearch-band">
      <SkyClouds />

      {/* Grain over the light, under the type. The pool of orange is a wide
          soft gradient, and wide soft gradients band on 8-bit displays; the
          texture is what breaks the steps up. */}
      <span className="dirsearch-bandgrain" aria-hidden="true" />

      <div className="dirsearch-bandhead container mx-auto px-4">
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
          {loading ? (
            <>Searching…</>
          ) : resultCount === 0 ? (
            <>No matches yet — try a broader search</>
          ) : (
            <>
              <strong>{resultCount}</strong>
              {resultCount === totalCount
                ? ' local businesses'
                : ` of ${totalCount} local businesses`}
              {/* Only claim an ordering the page is actually using. Saying
                  "closest first" under Best match is the kind of small lie
                  that makes people stop trusting the sort. */}
              {shared &&
                (nearestFirst ? ', closest first' : ', with distances')}
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

        {/* The local-first control. One sentence and one button rather than a
            permissions-style dialog, because the honest ask is small: we want
            to sort a list, and the coordinates never leave the browser. */}
        <div className="dirsearch-locbar">
          {shared ? (
            <>
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Showing distances from <strong>your location</strong>
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
              <span>
                Location is off, so distances are hidden. Narrowing by county
                works just as well.
              </span>
              <a className="dirsearch-locshare" href={`#${COUNTY_FILTER_ID}`}>
                Pick a county
              </a>
            </>
          ) : (
            <>
              <Crosshair className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Share your location to see what is closest to you</span>
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

      {/* In flow rather than absolutely placed, so the header is always as
          tall as its own content plus the street — the results below can never
          be overlapped by a rooftop on a screen size nobody tested. */}
      <div className="dirsearch-street">
        <StreetScene />
      </div>
    </section>
  );
}
