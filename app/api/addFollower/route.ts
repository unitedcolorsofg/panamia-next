import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { userId } = body; // ID of user to follow

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing userId parameter' },
      { status: 400 }
    );
  }

  // Can't follow yourself
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: 'Cannot follow yourself' },
      { status: 400 }
    );
  }

  const prisma = await getPrisma();

  // Check if already following
  const existingFollow = await prisma.userFollow.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.user.id,
        followingId: userId,
      },
    },
  });

  if (existingFollow) {
    return NextResponse.json({ error: 'Already following' }, { status: 400 });
  }

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    await prisma.userFollow.create({
      data: {
        followerId: session.user.id,
        followingId: userId,
      },
    });

    return NextResponse.json({
      success: true,
      msg: 'Successfully followed user',
    });
  } catch (err) {
    console.error('Error adding follower:', err);
    return NextResponse.json(
      { error: 'Failed to follow user' },
      { status: 500 }
    );
  }
}
