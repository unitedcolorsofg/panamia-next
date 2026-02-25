import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { newsletterSignups } from '@/lib/schema';
import { count } from 'drizzle-orm';
import { checkAdminAuth } from '@/lib/server/admin-auth';

export async function GET(request: NextRequest) {
  const adminUser = await checkAdminAuth();

  if (!adminUser) {
    return NextResponse.json(
      { error: 'Not Authorized:admin' },
      { status: 401 }
    );
  }

  let page_number = 1;
  if (request.nextUrl.searchParams.get('page_number')) {
    page_number = parseInt(
      request.nextUrl.searchParams.get('page_number')!.toString()
    );
    if (page_number < 1) {
      page_number = 1;
    }
  }

  const per_page = 20;
  const offset = per_page * page_number - per_page;

  const [{ total }] = await db
    .select({ total: count() })
    .from(newsletterSignups);
  const signupCount = Number(total);
  const pagination = {
    count: signupCount,
    per_page: per_page,
    offset: offset,
    page_number: page_number,
    total_pages: signupCount > 0 ? Math.ceil(signupCount / per_page) : 1,
  };

  const signupList = await db.query.newsletterSignups.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: per_page,
    offset,
  });

  return NextResponse.json({
    success: true,
    data: signupList || [],
    pagination: pagination,
  });
}
