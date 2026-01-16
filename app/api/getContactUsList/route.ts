import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import contactUs from '@/lib/model/contactus';
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

  await dbConnect();

  const contactUsCount = await contactUs.countDocuments();
  const pagination = {
    count: contactUsCount,
    per_page: per_page,
    offset: offset,
    page_number: page_number,
    total_pages: contactUsCount > 0 ? Math.ceil(contactUsCount / per_page) : 1,
  };

  const contactUsList = await contactUs
    .find()
    .sort({ createdAt: 'desc' })
    .limit(per_page)
    .skip(offset);

  return NextResponse.json({
    success: true,
    data: contactUsList || [],
    pagination: pagination,
  });
}
