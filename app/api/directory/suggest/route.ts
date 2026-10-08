import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseScope } from '@/lib/directory-scopes';
import { getSuggestions } from '@/lib/server/suggest';
import { MAX_TERM_LENGTH, MIN_TERM_LENGTH } from '@/lib/suggest';

/**
 * GET /api/directory/suggest?q=…&scope=… — the search box typeahead.
 *
 * Returns up to ten rows of whichever kind `scope` names — directory listings,
 * panas, relay groups or upcoming events. The queries and the visibility rules
 * live in lib/server/suggest.ts; this route is the session boundary and the
 * cache boundary, which are the two things that have to be decided per request.
 *
 * `scope` is optional and stays optional. A request without one gets every
 * kind the viewer may see, which is what this endpoint did before scopes
 * existed and what clients running the previous bundle will go on asking for
 * through a deploy. Same hazard as the path below, answered the same way.
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

  // Validated into a Scope or into nothing before it goes anywhere. An
  // unrecognised value is treated as no value rather than as an error: it is
  // indistinguishable from an old client at this layer, and a 400 would turn
  // a stale bundle into a dead search box.
  const requestedScope = parseScope(searchParams.get('scope'));

  // Panas are members-only, so the response body depends on who asked. A
  // failed session read must fall to the anonymous set rather than throw: the
  // public half of the answer is still correct and still useful.
  //
  // This is also the half of the scope decision the caller does not get a vote
  // in. `getSuggestions` hands both to `scopesToSearch`, which refuses a scope
  // this viewer cannot reach — so `?scope=pana` from a signed-out request is
  // an empty list, not a members-only one.
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
   * The anonymous response is public, anonymous data keyed by the term and
   * the scope, and gets the same edge treatment as /api/getDirectorySearch.
   * The scope needs nothing done to it to be part of that key: it travels as a
   * query parameter, so `?q=music&scope=event` and `?q=music` are two URLs and
   * a shared cache already treats them as two entries. Worth stating because
   * it was true that this was keyed on the term alone, and a future scope
   * carried in a header rather than the URL would silently serve one scope's
   * rows under another's.
   *
   * The signed-in response must never touch a shared cache. It contains the
   * members-only half — panas — and a shared entry would serve that to the
   * next anonymous visitor who typed the same two letters. `private` alone
   * would stop the CDN; `no-store` also keeps it out of the browser's disk
   * cache, which matters on a shared device. Vary: Cookie is belt and braces
   * for any intermediary that ignores the above.
   */
  const cacheHeaders = viewerIsSignedIn
    ? { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
    : {
        'Cache-Control':
          'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
        Vary: 'Cookie',
      };

  try {
    const data = await getSuggestions(term, {
      viewerIsSignedIn,
      scope: requestedScope,
    });
    return NextResponse.json({ success: true, data }, { headers: cacheHeaders });
  } catch (error) {
    console.error('Directory suggest error:', error);
    // A dead typeahead should not break the search box it sits under, so this
    // reads as "no suggestions" to the client rather than as a failure.
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
