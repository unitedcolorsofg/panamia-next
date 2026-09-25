'use client';

import { Crosshair, MapPin } from 'lucide-react';
import type { LocationStatus } from '@/app/p/[user]/_lib/use-viewer-location';
import { DirectorySuggest } from '@/components/directory-suggest';
import { ScopeMenu } from '@/components/directory-scope-bar';
import { COUNTY_FILTER_ID } from './filter-bar';
import { useScopeCounts } from '../_lib/use-scope-counts';

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
 * The top of the businesses view.
 *
 * This is the same band the four scope pages render, and that is the point.
 * Until now businesses opened with a compact white toolbar and the scope
 * pages opened with a tall indigo band, so the same search for the same shop
 * looked like two different products depending on which URL you arrived
 * through. One of them had to give, and the band won: it carries the term as
 * a headline, names the scope in a way that can be changed in place, and
 * gives the field the typeahead every other search box on the site has.
 *
 * The cost is real and was accepted deliberately. This page does not scroll —
 * the map holds the right half and the list scrolls inside its own pane — so
 * every pixel spent here is a pixel taken from results rather than from empty
 * space. The previous comment here argued that made a band the wrong shape
 * for a page you refine five times in a row. That argument lost to
 * consistency: a member who cannot tell whether they are still in the same
 * product is a worse outcome than a member who sees three results instead of
 * four before scrolling.
 *
 * Four things survived the swap and must keep surviving it:
 *
 * - The count is `role="status"`. It changes client-side here, unlike the
 *   scope pages' server-rendered `.dirsearch-count`, so it has to announce.
 * - Submitting runs `onSearch` rather than navigating. The filters, sort and
 *   map view live in this page's query string and a route push would drop
 *   them.
 * - The location bar stays. It is the one control that turns a list of
 *   businesses into a list you can get to, and it has no equivalent on the
 *   scope pages because only businesses have addresses to measure from.
 * - The scope menu sits inside the pill, not beside it, because scope is part
 *   of the question being asked rather than a setting on the page.
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
  const { counts, signedIn } = useScopeCounts(term);
  const shared = locationStatus === 'granted';

  return (
    <section className="dirsearch-band">
      <div className="container mx-auto px-4">
        <span className="section-eyebrow">Directory</span>

        {/* The page's heading is the page's heading. On the scope pages this
            is the visible title and there is no second one; the businesses
            view used to hide an h1 behind a toolbar because the toolbar had
            no room for type. It has room now. */}
        <h1 className="dirsearch-title">
          {term ? (
            <>
              <em>{term}</em> — businesses
            </>
          ) : (
            <>Find your people</>
          )}
        </h1>

        {/* Headline and count are separate lines here, matching the scope
            pages. It is a status message, not a heading — it says what the
            search is doing right now, so it announces itself when the answer
            changes instead of silently rewriting the page. */}
        <p className="dirsearch-count" role="status" aria-live="polite">
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
              {/* "1 businesses" is the kind of seam that makes a page look
                  unfinished on the exact search that found one perfect
                  answer. Only the all-shown branch names the noun; the
                  "12 of 340" branch is a ratio, which needs none. */}
              {resultCount === totalCount
                ? resultCount === 1
                  ? ' business'
                  : ' businesses'
                : ` of ${totalCount}`}
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

        <div className="dirsearch-searchrow">
          <DirectorySuggest
            layout="pill"
            scope="business"
            initialTerm={term}
            label="Search the Pana Mia directory"
            ariaLabel="Search the Pana Mia directory"
            placeholder="Try food, art, Hialeah, bike repair…"
            buttonLabel="Search"
            onSearch={onSearch}
            leading={
              <ScopeMenu
                scope="business"
                term={term}
                counts={counts}
                signedIn={signedIn}
              />
            }
          />
        </div>

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
