import { Suspense } from 'react';
import { SocialSearchContent } from './_components/search-content';

/**
 * Search across Pana Social: /search?q=zines&tab=groups
 *
 * The masthead field submits here as a plain GET, so this route is reached
 * with nothing but a query string and has to make sense of it alone.
 *
 * It is a hub rather than a replacement for the directory. Panas are answered
 * with the top few results and a link to /directory/search, which owns the
 * filters, the map and the pagination; groups are answered in full, because
 * this is their only search surface. Sending a member to the directory for a
 * group they will never find there is the failure this page exists to fix.
 *
 * Not under /s -- see the note on the social surface's `paths` in
 * lib/panaverse/surfaces.ts for why groups and search sit at the top level.
 */

/* Typed structurally rather than as `Metadata`: the vinext `next` shim does
   not export that type, and importing it adds to the repo's existing wall of
   "has no exported member 'Metadata'" errors for no benefit here. */
export const metadata = {
  title: 'Search | Pana Social',
  description: 'Find Panas and groups on Pana Social.',
  /* Noindex is load-bearing, not caution. Private groups are deliberately
     discoverable so a request-to-join group can be asked to join -- see
     GROUP_COLUMNS in lib/server/group-search.ts. That stance assumes a person
     doing the asking. A crawlable results page would turn it into bulk
     enumeration of every private group by anyone who can fetch a URL, which
     is a different thing entirely and not what was agreed. */
  robots: { index: false, follow: true },
};

function SearchFallback() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="bg-pana-ink/10 h-10 w-64 rounded-xl" />
      <div className="bg-pana-ink/10 h-24 rounded-2xl" />
      <div className="bg-pana-ink/10 h-24 rounded-2xl" />
    </div>
  );
}

export default function SocialSearchPage() {
  return (
    <main className="surface-cream min-h-screen pb-20">
      <div className="container mx-auto max-w-4xl px-4 pt-8">
        {/* The masthead field is the visible title of this page. A repeated
            "Search" heading under it would be noise, but a screen reader
            still needs something to land on. */}
        <h1 className="sr-only">Search Pana Social</h1>

        {/* useSearchParams suspends, and without a boundary the whole route
            opts out of static rendering with a build-time warning. */}
        <Suspense fallback={<SearchFallback />}>
          <SocialSearchContent />
        </Suspense>
      </div>
    </main>
  );
}
