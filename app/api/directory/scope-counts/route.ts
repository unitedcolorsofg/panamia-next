import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { countAllScopes } from '@/lib/server/search-kinds';
import { MAX_TERM_LENGTH } from '@/lib/suggest';
import { EMPTY_SCOPE_COUNTS } from '@/lib/directory-scopes';

/**
 * GET /api/directory/scope-counts?q=… — how many results each scope holds.
 *
 * Every scope page computes these on the server and hands them straight to the
 * chips. The businesses view cannot: it is a client component whose term lives
 * in a query parameter it reads itself, so there is no server render that knows
 * the term. This route is the counts for that one caller.
 *
 * The chips are navigation first and numbers second — a failure here returns
 * zeroes rather than an error, so the bar still renders and still links.
 */
export async function GET(request: NextRequest) {
  const searchParams = (request.nextUrl ?? new URL(request.url)).searchParams;
  const term = (searchParams.get('q') || '').trim().slice(0, MAX_TERM_LENGTH);

  // Same stance as the suggest route: panas and groups are members-only, so
  // the body depends on who asked, and a failed session read falls back to the
  // anonymous answer instead of throwing.
  let viewerIsSignedIn = false;
  try {
    const session = await auth();
    viewerIsSignedIn = Boolean(session?.user?.id);
  } catch (error) {
    console.error('Directory scope-counts session error:', error);
  }

  // A signed-in body carries the members-only counts, which must never land in
  // a shared cache. See the long note in the suggest route.
  const cacheHeaders = viewerIsSignedIn
    ? { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
    : {
        'Cache-Control':
          'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
        Vary: 'Cookie',
      };

  try {
    const data = await countAllScopes(term, viewerIsSignedIn);
    return NextResponse.json({ success: true, data }, { headers: cacheHeaders });
  } catch (error) {
    console.error('Directory scope-counts error:', error);
    return NextResponse.json(
      { success: false, data: EMPTY_SCOPE_COUNTS },
      { status: 500 },
    );
  }
}
