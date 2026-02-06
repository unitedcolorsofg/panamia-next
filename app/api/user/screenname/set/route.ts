import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { validateScreennameFull } from '@/lib/screenname';

// Rate limit: once per 90 days (~3 months)
const SCREENNAME_COOLDOWN_DAYS = 90;

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  const email = session.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json(
      { success: false, error: 'No email in session' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { screenname } = body;

  if (!screenname) {
    return NextResponse.json(
      { success: false, error: 'Screenname is required' },
      { status: 400 }
    );
  }

  const prisma = await getPrisma();
  const newScreenname = screenname.trim();

  // Fetch current user state including rate limit check
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      screenname: true,
      lastScreennameChange: true,
      profile: { select: { socialActor: { select: { id: true } } } },
    },
  });

  // Check if screenname is actually changing
  if (
    currentUser?.screenname &&
    currentUser.screenname.toLowerCase() === newScreenname.toLowerCase()
  ) {
    return NextResponse.json({
      success: true,
      data: { screenname: currentUser.screenname, timelineReset: false },
    });
  }

  // Rate limit check (only applies if user already has a screenname)
  if (currentUser?.screenname && currentUser?.lastScreennameChange) {
    const daysSinceChange = Math.floor(
      (Date.now() - currentUser.lastScreennameChange.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysSinceChange < SCREENNAME_COOLDOWN_DAYS) {
      const nextChangeDate = new Date(
        currentUser.lastScreennameChange.getTime() +
          SCREENNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
      );
      return NextResponse.json(
        {
          success: false,
          error: `You can change your screenname again on ${nextChangeDate.toLocaleDateString()}`,
        },
        { status: 429 }
      );
    }
  }

  // Validate format and availability (excluding current user)
  const validation = await validateScreennameFull(screenname, email);
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error },
      { status: 400 }
    );
  }

  // Archive current screenname to history (if they have one and it's changing)
  if (currentUser?.screenname) {
    await prisma.screennameHistory.create({
      data: {
        screenname: currentUser.screenname,
        userId: session.user.id,
        redirectTo: newScreenname,
      },
    });
  }

  // If social actor exists, delete all their statuses (timeline + DMs reset)
  const hasSocialActor = !!currentUser?.profile?.socialActor;
  if (hasSocialActor) {
    const actorId = currentUser.profile!.socialActor!.id;

    // Delete all statuses authored by this actor
    await prisma.socialStatus.deleteMany({
      where: { actorId },
    });

    // Reset status count
    await prisma.socialActor.update({
      where: { id: actorId },
      data: { statusCount: 0 },
    });
  }

  // Update user screenname and record change timestamp
  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      screenname: newScreenname,
      lastScreennameChange: currentUser?.screenname ? new Date() : undefined,
    },
    select: { screenname: true, profile: { select: { socialActor: true } } },
  });

  // Sync screenname to SocialActor if one exists
  if (updatedUser.profile?.socialActor) {
    const actor = updatedUser.profile.socialActor;
    // Import socialConfig dynamically to avoid circular deps
    const {
      getActorUrl,
      getInboxUrl,
      getOutboxUrl,
      getFollowersUrl,
      getFollowingUrl,
    } = await import('@/lib/federation');

    await prisma.socialActor.update({
      where: { id: actor.id },
      data: {
        username: newScreenname,
        uri: getActorUrl(newScreenname),
        inboxUrl: getInboxUrl(newScreenname),
        outboxUrl: getOutboxUrl(newScreenname),
        followersUrl: getFollowersUrl(newScreenname),
        followingUrl: getFollowingUrl(newScreenname),
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      screenname: updatedUser.screenname,
      timelineReset: hasSocialActor && !!currentUser?.screenname,
    },
  });
}

export const maxDuration = 5;
