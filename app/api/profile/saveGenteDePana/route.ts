// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({
      success: false,
      error: 'No user session available',
    });
  }

  const { discount_code, discount_percentage, discount_details } = body;

  const prisma = await getPrisma();

  // Find user's profile
  const existingProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (!existingProfile) {
    return NextResponse.json({
      success: false,
      error: 'Could not find profile',
    });
  }

  try {
    const updatedProfile = await prisma.profile.update({
      where: { id: existingProfile.id },
      data: {
        gentedepana: {
          code: discount_code,
          percentage: discount_percentage,
          details: discount_details,
        },
      },
    });

    return NextResponse.json(
      { success: true, data: updatedProfile },
      { status: 200 }
    );
  } catch (e) {
    if (e instanceof Error) {
      console.log(e.message);
      return NextResponse.json(
        { success: false, error: e.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Unknown error' },
      { status: 500 }
    );
  }
}
