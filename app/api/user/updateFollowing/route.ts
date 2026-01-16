import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

interface ResponseData {
  error?: string;
  success?: boolean;
  msg?: string;
  data?: any;
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({
      success: false,
      error: 'No user session available',
    });
  }

  const body = await request.json();
  const { action, id } = body;

  if (!id) {
    return NextResponse.json({
      success: false,
      error: 'Missing user id to follow/unfollow',
    });
  }

  // Can't follow yourself
  if (id === session.user.id) {
    return NextResponse.json({
      success: false,
      error: 'Cannot follow yourself',
    });
  }

  const prisma = await getPrisma();

  try {
    let msg = 'No action';

    if (action === 'follow') {
      // Check if already following
      const existing = await prisma.userFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: id,
          },
        },
      });

      if (existing) {
        msg = 'Already following';
      } else {
        // Verify target user exists
        const targetUser = await prisma.user.findUnique({
          where: { id },
        });

        if (!targetUser) {
          return NextResponse.json({
            success: false,
            error: 'User not found',
          });
        }

        await prisma.userFollow.create({
          data: {
            followerId: session.user.id,
            followingId: id,
          },
        });
        msg = 'Followed';
      }
    }

    if (action === 'unfollow') {
      const result = await prisma.userFollow.deleteMany({
        where: {
          followerId: session.user.id,
          followingId: id,
        },
      });

      if (result.count > 0) {
        msg = 'Unfollowed';
      } else {
        msg = 'Already unfollowed';
      }
    }

    // Get updated user data
    const updatedUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        screenname: true,
      },
    });

    console.log('updateFollowing:', msg);

    return NextResponse.json({
      success: true,
      data: updatedUser,
      msg: msg,
    });
  } catch (err) {
    console.error('Error updating following:', err);
    return NextResponse.json({
      success: false,
      error: 'Failed to update following',
    });
  }
}
