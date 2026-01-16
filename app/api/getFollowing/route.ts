import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/**
 * Get list of users that a user is following
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing userId parameter' },
      { status: 400 }
    );
  }

  const prisma = await getPrisma();

  try {
    const following = await prisma.userFollow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            id: true,
            email: true,
            screenname: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Return the followed users
    const users = following.map((f) => ({
      id: f.following.id,
      email: f.following.email,
      screenname: f.following.screenname,
      followedAt: f.createdAt,
    }));

    return NextResponse.json(users);
  } catch (err) {
    console.error('Error getting following:', err);
    return NextResponse.json(
      { error: 'Failed to get following list' },
      { status: 500 }
    );
  }
}
