import { NextRequest, NextResponse } from 'next/server';
import { forceInt, forceString } from '@/lib/standardized';
import { checkAdminAuth } from '@/lib/server/admin-auth';
import { getAdminSearch } from '@/lib/server/admin';

export async function GET(request: NextRequest) {
  const adminUser = await checkAdminAuth();

  if (!adminUser) {
    return NextResponse.json(
      { error: 'Not Authorized:admin' },
      { status: 401 }
    );
  }

  const rq = request.nextUrl.searchParams;
  const pageNum = forceInt(forceString(rq?.get('page') || undefined, '1'), 1);
  const pageLimit = forceInt(
    forceString(rq?.get('limit') || undefined, '20'),
    20
  );
  const searchTerm = forceString(rq?.get('q') || undefined, '');

  const params = { pageNum, pageLimit, searchTerm };

  const apiResponse = await getAdminSearch(params);
  if (apiResponse) {
    return NextResponse.json(apiResponse, { status: 200 });
  }

  return NextResponse.json(
    { success: true, data: [], pagination: {} },
    { status: 200 }
  );
}
