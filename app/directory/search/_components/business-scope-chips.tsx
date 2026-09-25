'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { ScopeChips } from '@/components/directory-scope-bar';
import type { ScopeCounts } from '@/lib/directory-scopes';

/**
 * The scope bar for the businesses view.
 *
 * The other four scopes render their chips on the server, where the term and
 * the session are both in hand. This one cannot: businesses is a client view
 * whose term lives in a query parameter it reads itself, so nothing on the
 * server knows what was searched. It fetches the counts instead.
 *
 * Chips render immediately without numbers and fill them in when the request
 * lands — the bar's job is to get you to the other scopes, and making that
 * wait on a count would be the wrong trade.
 */
export function BusinessScopeChips({ term }: { term: string }) {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user?.id);
  const [counts, setCounts] = useState<ScopeCounts | null>(null);

  useEffect(() => {
    if (!term) {
      setCounts(null);
      return;
    }

    // Aborted on term change so a slow response for an old term cannot land
    // after a fast one for the current term and show stale numbers.
    const controller = new AbortController();

    fetch(`/api/directory/scope-counts?q=${encodeURIComponent(term)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.success) setCounts(body.data as ScopeCounts);
      })
      .catch(() => {
        // Counts are decoration on a navigation bar. Failing quietly leaves
        // the chips working, which is the part that matters.
      });

    return () => controller.abort();
  }, [term, signedIn]);

  return (
    <ScopeChips
      term={term}
      scope="business"
      counts={counts}
      signedIn={signedIn}
    />
  );
}
