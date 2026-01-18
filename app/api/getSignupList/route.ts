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

  const signupCount = await prisma.newsletterSignup.count();
  const pagination = {
    count: signupCount,
    per_page: per_page,
    offset: offset,
    page_number: page_number,
    total_pages: signupCount > 0 ? Math.ceil(signupCount / per_page) : 1,
  };

  const signupList = await prisma.newsletterSignup.findMany({
    orderBy: { createdAt: 'desc' },
    take: per_page,
    skip: offset,
  });

  return NextResponse.json({
    success: true,
    data: signupList || [],
    pagination: pagination,
  });
}
