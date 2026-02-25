import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { count, desc } from 'drizzle-orm';
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

  const [{ total }] = await db.select({ total: count() }).from(users);
  const listCount = Number(total);
  const pagination = {
    count: listCount,
    per_page: per_page,
    offset: offset,
    page_number: page_number,
    total_pages: listCount > 0 ? Math.ceil(listCount / per_page) : 1,
  };

  const paginatedList = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      screenname: users.screenname,
      role: users.role,
      accountType: users.accountType,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(per_page)
    .offset(offset);

  // Format response for backward compatibility
  const formattedList = paginatedList.map((user) => ({
    _id: user.id,
    email: user.email,
    name: user.name,
    screenname: user.screenname,
    status: { role: user.role },
    accountType: user.accountType,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }));

  return NextResponse.json({
    success: true,
    data: formattedList,
    pagination: pagination,
  });
}
