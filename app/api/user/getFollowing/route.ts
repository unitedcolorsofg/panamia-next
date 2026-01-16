import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { unguardProfile } from '@/lib/profile';

/**
 * Get profiles of users that the current user is following
 */
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

    // Get following relationships from UserFollow table
    const following = await prisma.userFollow.findMany({
      where: { followerId: session.user.id },
      include: {
        following: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (following.length === 0) {
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }

    // Get profiles for followed users
    const followingEmails = following
      .map((f) => f.following.email)
      .filter((email): email is string => email !== null);

    const followingProfiles = await prisma.profile.findMany({
      where: {
        email: { in: followingEmails },
        active: true,
      },
    });

    const profiles = followingProfiles.map((guardedProfile) => {
      return unguardProfile(guardedProfile);
    });

    return NextResponse.json(
      { success: true, data: profiles },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting following:', error);
    return NextResponse.json({
      success: false,
      error: `Server Error ${error}`,
    });
  }
}
