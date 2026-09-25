'use client';

import { ScopeChips } from '@/components/directory-scope-bar';
import { useScopeCounts } from '../_lib/use-scope-counts';

/**
 * The scope bar for the businesses view.
 *
 * Thin on purpose: the counts it needs are the same ones the search band's
 * scope menu needs, so both read them from `useScopeCounts` rather than each
 * running its own request. All this adds is the chips' own scope and term.
 */
export function BusinessScopeChips({ term }: { term: string }) {
  const { counts, signedIn } = useScopeCounts(term);

  return (
    <ScopeChips
      term={term}
      scope="business"
      counts={counts}
      signedIn={signedIn}
    />
  );
}
