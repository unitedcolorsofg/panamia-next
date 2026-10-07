'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { ScopeMenu } from '@/components/directory-scope-bar';
import type { Scope, ScopeCounts } from '@/lib/directory-scopes';

/**
 * The scope menu, with its counts fetched after the page is already on screen.
 *
 * The counts are the reason this exists. `countAllScopes` runs a full-text
 * query per scope, and awaiting it in a server component puts all four of them
 * in front of the first byte -- the band, the heading, and the search box all
 * wait on numbers that are decoration on a navigation control. On a healthy
 * database that is a slow page; on an unhealthy one it is a page that appears
 * not to respond, because `router.push` commits the URL only once the payload
 * resolves, so the address bar does not even change while it hangs. That was
 * measured at roughly twelve seconds of a search box that looked broken.
 *
 * So the counts move to the client and the shell never waits for them. The
 * menu renders immediately with `counts={null}` -- every row is still there,
 * still reachable, still labelled -- and the numbers appear when they arrive,
 * or never, which is survivable for a number in parentheses.
 *
 * Server pages render this instead of `ScopeMenu` directly. They keep their
 * own `auth()` call when a gate depends on it, because a privacy decision must
 * not wait on client state; the `signedIn` here only decides whether the panas
 * row is drawn as reachable or locked, which is allowed to settle on hydration.
 */
export function ScopeMenuLive({ scope, term }: { scope: Scope; term: string }) {
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

  return (
    <ScopeMenu scope={scope} term={term} counts={counts} signedIn={signedIn} />
  );
}
