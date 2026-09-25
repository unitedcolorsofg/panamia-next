'use client';

import { useState } from 'react';
import { UnifiedCard } from './unified-card';
import { UnifiedChrome, type MockScope } from './unified-chrome';
import { UNIFIED_RESULTS } from './../_data';

/**
 * The mock itself. Client-side only because the scope chips are the whole
 * demonstration — the point is not any one scope, it is that moving between
 * them changes what is in the cards without changing the page around them.
 */
export function UnifiedDirectory() {
  const [scope, setScope] = useState<MockScope>('all');

  const results =
    scope === 'all'
      ? UNIFIED_RESULTS
      : UNIFIED_RESULTS.filter((result) => result.kind === scope);

  return (
    /* `dirscope`, the scope page's own wrapper, because the band stays and
       this is that page growing a better card rather than a new page. It is
       also load-bearing: the --story-* palette is scoped to
       `body:has(.dirsearch), body:has(.dirscope), …` in globals.css, so a
       page that carries neither renders on a transparent background with
       nothing in the console to say why. */
    <main className="dirscope">
      <UnifiedChrome
        scope={scope}
        onScope={setScope}
        resultCount={results.length}
      />

      {/* The scope page's own results container. `px-4` is where the mobile
          gutter comes from here — on the businesses page that job belongs to
          `.dirsearch-listbody`, part of the split scrolling pane this page
          does not have. */}
      <div className="container mx-auto px-4 pt-6 pb-16">
        <ul className="dirsearch-grid">
          {results.map((result) => (
            <li key={result.id}>
              <UnifiedCard result={result} />
            </li>
          ))}
        </ul>

        {/* Per app/mock/README.md, a mock names its own route so a screenshot
            taken out of context still says where it came from. */}
        <p className="mx-auto mt-10 max-w-[58rem] text-center text-xs opacity-60">
          Design mock — <code>/mock/directory-unified</code>. The band and its
          search bar are unchanged; the cards and the facet rail are the
          proposal. Static fixtures, nothing here reads the database.
        </p>
      </div>
    </main>
  );
}
