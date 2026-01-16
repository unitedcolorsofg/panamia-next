import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ deleted: true }, { status: 404 });
  }

  try {
    const prisma = await getPrisma();

    // Find user by ID
    const foundUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!foundUser) {
      return NextResponse.json({ deleted: true });
    }

    // Find associated profile if exists
    const userProfile = await prisma.profile.findFirst({
      where: {
        email: foundUser.email,
        active: true,
      },
    });

    const verification = userProfile?.verification as {
      panaVerified?: boolean;
    } | null;

    return NextResponse.json({
      screenname: foundUser.screenname || null,
      profileSlug: userProfile?.slug || null,
      verified: verification?.panaVerified || false,
    });
  } catch (error) {
    console.error('Author lookup error:', error);
    return NextResponse.json({ deleted: true }, { status: 500 });
  }
}

export const maxDuration = 5;
