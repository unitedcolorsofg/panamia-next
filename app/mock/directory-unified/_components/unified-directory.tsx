'use client';

import { useState } from 'react';
import { UnifiedCard } from './unified-card';
import { UnifiedChrome, type MockScope } from './unified-chrome';
import { UNIFIED_RESULTS } from '../_data';

/**
 * The mock itself. Client-side only because the SHOW chips are the whole
 * demonstration — the point is not any one scope, it is that moving between
 * them does not change the page.
 */
export function UnifiedDirectory() {
  const [scope, setScope] = useState<MockScope>('all');

  const results =
    scope === 'all'
      ? UNIFIED_RESULTS
      : UNIFIED_RESULTS.filter((result) => result.kind === scope);

  return (
    /* The `dirsearch` class is load-bearing, not decorative. The --story-*
       palette is scoped to `body:has(.dirsearch), body:has(.dirscope), …` in
       globals.css, so a page that omits it renders on a transparent
       background with nothing in the console to explain why. */
    <main className="dirsearch">
      <UnifiedChrome
        scope={scope}
        onScope={setScope}
        resultCount={results.length}
      />

      {/* `.dirsearch-results` only supplies padding-block. On the live
          Businesses page the inline gutter comes from `.dirsearch-listbody`,
          which exists because that page is a split scrolling pane — a shell
          this mock does not have. Without replacing it, cards run edge to
          edge at 390px, which is exactly the mobile complaint that started
          this. Held on the wrapper rather than the cards so it matches. */}
      <div className="dirsearch-results px-4">
        <p className="border-pana-ink/10 bg-pana-butter-2/60 mx-auto mb-6 max-w-[58rem] rounded-xl border px-4 py-3 text-sm">
          <strong>Mock.</strong> Proposed merge of the Businesses view and the
          Everything/scope views into one theme. Use the SHOW chips — the
          chrome, the card and the rhythm hold still while the content rules
          change per kind.
        </p>

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
          Design mock — <code>/mock/directory-unified</code>. Static fixtures;
          nothing here reads the database.
        </p>
      </div>
    </main>
  );
}
