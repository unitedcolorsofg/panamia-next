import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
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

  const prisma = await getPrisma();

  const listCount = await prisma.user.count();
  const pagination = {
    count: listCount,
    per_page: per_page,
    offset: offset,
    page_number: page_number,
    total_pages: listCount > 0 ? Math.ceil(listCount / per_page) : 1,
  };

  const paginatedList = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: per_page,
    skip: offset,
    select: {
      id: true,
      email: true,
      name: true,
      screenname: true,
      role: true,
      accountType: true,
      createdAt: true,
      updatedAt: true,
    },
  });

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
