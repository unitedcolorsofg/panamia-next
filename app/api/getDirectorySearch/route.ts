import { NextRequest, NextResponse } from 'next/server';
import { forceInt, forceString } from '@/lib/standardized';
import { getSearch } from '@/lib/server/directory';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
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
  const geolat = forceString(searchParams.get('geolat') || undefined, '');
  const geolng = forceString(searchParams.get('geolng') || undefined, '');
  const resultsView = forceString(searchParams.get('v') || undefined, '');

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
  };

  const apiResponse = await getSearch(params);
  if (apiResponse) {
    return NextResponse.json(apiResponse);
  }
  return NextResponse.json({ success: true, data: [], pagination: {} });
}

export const maxDuration = 5;
