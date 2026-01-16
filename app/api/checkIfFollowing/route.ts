import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/**
 * Check if one user is following another
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const followerId = searchParams.get('followerId');
  const userId = searchParams.get('userId'); // The user being followed

  if (!followerId || !userId) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  const prisma = await getPrisma();

  try {
    const follow = await prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId: followerId,
          followingId: userId,
        },
      },
    });

    return NextResponse.json(!!follow);
  } catch (err) {
    console.error('Error checking follow status:', err);
    return NextResponse.json(
      { error: 'Failed to check follow status' },
      { status: 500 }
    );
  }
}
