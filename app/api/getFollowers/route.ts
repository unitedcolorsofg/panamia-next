import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/**
 * Get list of users who follow a given user
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
    const followers = await prisma.userFollow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            email: true,
            screenname: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Return the follower users
    const users = followers.map((f) => ({
      id: f.follower.id,
      email: f.follower.email,
      screenname: f.follower.screenname,
      followedAt: f.createdAt,
    }));

    return NextResponse.json(users);
  } catch (err) {
    console.error('Error getting followers:', err);
    return NextResponse.json(
      { error: 'Failed to get followers list' },
      { status: 500 }
    );
  }
}
