'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import type { ScopeCounts } from '@/lib/directory-scopes';

/**
 * How many results the other scopes hold for this term.
 *
 * The other four scopes count on the server, where the term is a route
 * segment and the session is already resolved. Businesses cannot: it is a
 * client view whose term lives in a query parameter it reads itself, so
 * nothing on the server rendering the page knows what was searched.
 *
 * Two things on this page want the same numbers — the scope menu inside the
 * search pill and the scope chip strip under it — so the fetch lives here
 * rather than in either of them. Running it twice would double the request
 * on every keystroke-completed search for numbers that are decoration.
 *
 * Returns `null` until the first response lands. Both consumers render
 * without numbers in the meantime, because getting to another scope is the
 * job and making that wait on a count would be the wrong trade.
 */
export function useScopeCounts(term: string) {
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
        // Counts are decoration on a navigation control. Failing quietly
        // leaves the navigation working, which is the part that matters.
      });

    return () => controller.abort();
  }, [term, signedIn]);

  return { counts, signedIn };
}
