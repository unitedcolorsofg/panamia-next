import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { userId } = body; // ID of user to unfollow

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing userId parameter' },
      { status: 400 }
    );
  }

  const prisma = await getPrisma();

  try {
    // Delete the follow relationship
    const result = await prisma.userFollow.deleteMany({
      where: {
        followerId: session.user.id,
        followingId: userId,
      },
    });

    if (result.count > 0) {
      return NextResponse.json({
        success: true,
        msg: 'Successfully unfollowed user',
      });
    } else {
      return NextResponse.json(
        { error: 'Follower relationship not found' },
        { status: 404 }
      );
    }
  } catch (err) {
    console.error('Error removing follower:', err);
    return NextResponse.json(
      { error: 'Failed to unfollow user' },
      { status: 500 }
    );
  }
}
