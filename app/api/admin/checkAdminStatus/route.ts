import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { success: false, data: { admin_status: false } },
      { status: 200 }
    );
  }

  // Admin status is determined by ADMIN_EMAILS env var, set in session callback
  return NextResponse.json({
    success: true,
    data: { admin_status: session.user?.isAdmin || false },
  });
}
