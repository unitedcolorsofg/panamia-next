import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSuggestions } from '@/lib/server/suggest';
import { MAX_TERM_LENGTH, MIN_TERM_LENGTH } from '@/lib/suggest';

/**
 * GET /api/directory/suggest?q=… — the search box typeahead.
 *
 * Returns up to ten rows drawn from four kinds: directory listings, panas,
 * relay groups, and upcoming events. The queries and the visibility rules live
 * in lib/server/suggest.ts; this route is the session boundary and the cache
 * boundary, which are the two things that have to be decided per request.
 *
 * The path is still /api/directory/suggest. Renaming it would be tidier and
 * would break every deployed client mid-rollout for the sake of a noun.
 */
export async function GET(request: NextRequest) {
  const searchParams = (request.nextUrl ?? new URL(request.url)).searchParams;
  const term = (searchParams.get('q') || '').trim().slice(0, MAX_TERM_LENGTH);

  if (term.length < MIN_TERM_LENGTH) {
    return NextResponse.json({ success: true, data: [] });
  }

  // Panas and groups are members-only, so the response body now depends on who
  // asked. A failed session read must fall to the anonymous set rather than
  // throw: the public half of the answer is still correct and still useful.
  let viewerIsSignedIn = false;
  try {
    const session = await auth();
    viewerIsSignedIn = Boolean(session?.user?.id);
  } catch (error) {
    console.error('Directory suggest session error:', error);
  }

  /**
   * Cache-Control, and why it is two different answers.
   *
   * The anonymous response is public, anonymous data keyed entirely by the
   * term, and gets the same edge treatment as /api/getDirectorySearch.
   *
   * The signed-in response must never touch a shared cache. It contains the
   * members-only half — panas and groups — and a shared entry would serve that
   * to the next anonymous visitor who typed the same two letters. `private`
   * alone would stop the CDN; `no-store` also keeps it out of the browser's
   * disk cache, which matters on a shared device. Vary: Cookie is belt and
   * braces for any intermediary that ignores the above.
   */
  const cacheHeaders = viewerIsSignedIn
    ? { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
    : {
        'Cache-Control':
          'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
        Vary: 'Cookie',
      };

  try {
    const data = await getSuggestions(term, { viewerIsSignedIn });
    return NextResponse.json({ success: true, data }, { headers: cacheHeaders });
  } catch (error) {
    console.error('Directory suggest error:', error);
    // A dead typeahead should not break the search box it sits under, so this
    // reads as "no suggestions" to the client rather than as a failure.
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
