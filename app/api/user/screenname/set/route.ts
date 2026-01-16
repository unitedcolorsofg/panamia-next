import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { validateScreennameFull } from '@/lib/screenname';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  const email = session.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json(
      { success: false, error: 'No email in session' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { screenname } = body;

  if (!screenname) {
    return NextResponse.json(
      { success: false, error: 'Screenname is required' },
      { status: 400 }
    );
  }

  // Validate format and availability (excluding current user)
  const validation = await validateScreennameFull(screenname, email);
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error },
      { status: 400 }
    );
  }

  const prisma = await getPrisma();

  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: { screenname: screenname.trim() },
    select: { screenname: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      screenname: updatedUser.screenname,
    },
  });
}

export const maxDuration = 5;
