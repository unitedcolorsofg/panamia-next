import { NextRequest, NextResponse } from 'next/server';
import { forceInt, forceString } from '@/lib/standardized';
import { getSearch, isDirectorySort } from '@/lib/server/directory';

/**
 * Coarsen a coordinate before it is used.
 *
 * Two decimal places is about a kilometre, which is more than enough to say
 * "3 mi away" and not enough to say where somebody lives. It also bounds the
 * edge-cache key: full precision would make every visitor's URL unique, so the
 * cache would never hit and every raw location would end up in a CDN log.
 */
function coarsen(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || value.trim() === '') return '';
  return parsed.toFixed(2);
}

export async function GET(request: NextRequest) {
  const searchParams =
    request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
  const pageNum = forceInt(
    forceString(searchParams.get('page') || undefined, '1'),
    1
  );
  const pageLimit = forceInt(
    forceString(searchParams.get('limit') || undefined, '20'),
    20
  );
  const searchTerm = forceString(searchParams.get('q') || undefined, '');
  const paramRandom = forceInt(
    forceString(searchParams.get('random') || undefined, '0'),
    0
  );
  const filterLocations = forceString(
    searchParams.get('floc') || undefined,
    ''
  );
  const filterCategories = forceString(
    searchParams.get('fcat') || undefined,
    ''
  );
  const geolat = coarsen(
    forceString(searchParams.get('geolat') || undefined, '')
  );
  const geolng = coarsen(
    forceString(searchParams.get('geolng') || undefined, '')
  );
  const resultsView = forceString(searchParams.get('v') || undefined, '');
  const sortParam = searchParams.get('sort');
  // An unrecognised sort falls back to relevance rather than erroring: it
  // arrives from a URL somebody may have edited or a link from an older build.
  const sort = isDirectorySort(sortParam) ? sortParam : 'relevance';
  const certifiedOnly = searchParams.get('certified') === 'true';
  const withEventsOnly = searchParams.get('events') === 'true';
  const mentorsOnly = searchParams.get('mentors') === 'true';
  const expertise = forceString(searchParams.get('expertise') || undefined, '');
  const languages = forceString(searchParams.get('lang') || undefined, '');
  const freeOnly = searchParams.get('free') === 'true';

  let random = paramRandom;
  if (searchTerm.length == 0 && random == 0) {
    random = Math.ceil(Math.random() * 100000);
  }

  const params = {
    pageNum,
    pageLimit,
    searchTerm,
    filterLocations,
    filterCategories,
    random,
    geolat,
    geolng,
    resultsView,
    sort,
    certifiedOnly,
    withEventsOnly,
    mentorsOnly,
    expertise,
    languages,
    freeOnly,
  };

  // Public, anonymous directory data — cacheable at the edge (Workers Cache).
  // Keyed by full URL, so each distinct search caches separately. Note: an
  // empty query generates a server-side `random` batch that is not in the URL,
  // so all default-browse visitors share the same batch for the TTL.
  const cacheHeaders = {
    'Cache-Control':
      'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
  };

  const apiResponse = await getSearch(params);
  if (apiResponse) {
    return NextResponse.json(apiResponse, { headers: cacheHeaders });
  }
  return NextResponse.json(
    {
      success: true,
      data: [],
      pagination: { page: pageNum, limit: pageLimit, total: 0, totalPages: 0 },
    },
    { headers: cacheHeaders }
  );
}
