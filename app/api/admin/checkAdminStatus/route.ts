import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { success: false, data: { admin_status: false } },
      { status: 200 }
    );
  }

  await dbConnect();
  const userSession = session?.user?.email
    ? await user.findOne({ email: session.user.email })
    : null;

  const isAdmin = userSession?.status?.role === 'admin';

  return NextResponse.json({
    success: true,
    data: { admin_status: isAdmin },
  });
}
