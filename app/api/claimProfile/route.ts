import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import profile from '@/lib/model/profile';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json(
      { error: 'You must be signed in to claim a profile.' },
      { status: 401 }
    );
  }

  await dbConnect();

  // Find profile with user's email that doesn't have a userId
  const unclaimedProfile = await profile.findOne({
    email: session.user.email.toLowerCase(),
    $or: [{ userId: { $exists: false } }, { userId: null }],
  });

  if (!unclaimedProfile) {
    return NextResponse.json(
      { error: 'No unclaimed profile found with your email.' },
      { status: 404 }
    );
  }

  // Claim the profile by adding userId
  try {
    unclaimedProfile.userId = session.user.id;
    await unclaimedProfile.save();

    return NextResponse.json(
      {
        success: true,
        message: 'Profile claimed successfully!',
        profile: {
          name: unclaimedProfile.name,
          email: unclaimedProfile.email,
          active: unclaimedProfile.active,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error claiming profile:', error);
    return NextResponse.json(
      { error: 'Failed to claim profile. Please contact support.' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if user has an unclaimed profile
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ hasUnclaimedProfile: false }, { status: 200 });
  }

  await dbConnect();

  const unclaimedProfile = await profile.findOne({
    email: session.user.email.toLowerCase(),
    $or: [{ userId: { $exists: false } }, { userId: null }],
  });

  if (unclaimedProfile) {
    return NextResponse.json(
      {
        hasUnclaimedProfile: true,
        profile: {
          name: unclaimedProfile.name,
          email: unclaimedProfile.email,
          submitted: unclaimedProfile.status?.submitted,
        },
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ hasUnclaimedProfile: false }, { status: 200 });
}

export const maxDuration = 5;
