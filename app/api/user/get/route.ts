import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'No user session available',
      });
    }

    const prisma = await getPrisma();

    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        screenname: true,
        role: true,
        accountType: true,
        profile: {
          select: {
            name: true,
          },
        },
      },
    });

    if (existingUser) {
      return NextResponse.json({
        success: true,
        data: {
          email: existingUser.email,
          screenname: existingUser.screenname,
          name: existingUser.profile?.name,
          status: {
            role: existingUser.role,
          },
          accountType: existingUser.accountType,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Could not find User' });
  } catch (error) {
    console.error('Error getting user:', error);
    return NextResponse.json({
      success: false,
      error: `Server Error ${error}`,
    });
  }
}
