import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { validateScreennameFull } from '@/lib/screenname';

// Rate limit: once per 90 days (~3 months)
const SCREENNAME_COOLDOWN_DAYS = 90;

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: 'No user session available' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const email = session.user?.email
    ? (session.user?.email as string).toLowerCase()
    : null;

  const { name, zip_code, screenname } = body;

  if (!email) {
    return NextResponse.json(
      { error: 'Email value required' },
      { status: 200 }
    );
  }

  // Validate screenname if provided
  if (screenname) {
    const validation = await validateScreennameFull(screenname, email);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
  }

  const prisma = await getPrisma();

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      profile: { include: { socialActor: true } },
    },
  });

  if (!existingUser) {
    return NextResponse.json(
      { success: true, error: 'Could not find user' },
      { status: 401 }
    );
  }

  const newScreenname = screenname?.trim();
  const isScreennameChanging =
    newScreenname &&
    existingUser.screenname &&
    existingUser.screenname.toLowerCase() !== newScreenname.toLowerCase();

  // Rate limit check for screenname changes
  if (isScreennameChanging && existingUser.lastScreennameChange) {
    const daysSinceChange = Math.floor(
      (Date.now() - existingUser.lastScreennameChange.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysSinceChange < SCREENNAME_COOLDOWN_DAYS) {
      const nextChangeDate = new Date(
        existingUser.lastScreennameChange.getTime() +
          SCREENNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
      );
      throw new Error(
        `You can change your screenname again on ${nextChangeDate.toLocaleDateString()}`
      );
    }
  }

  // Archive old screenname to history if changing
  if (isScreennameChanging && existingUser.screenname) {
    await prisma.screennameHistory.create({
      data: {
        screenname: existingUser.screenname,
        userId: existingUser.id,
        redirectTo: newScreenname,
      },
    });
  }

  // Delete timeline if screenname is changing and user has social actor
  if (isScreennameChanging && existingUser.profile?.socialActor) {
    const actorId = existingUser.profile.socialActor.id;

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

  // Build update data
  const updateData: {
    name?: string;
    zipCode?: string;
    screenname?: string;
    lastScreennameChange?: Date;
  } = {};
  if (name) {
    updateData.name = name;
  }
  if (zip_code) {
    updateData.zipCode = zip_code;
  }
  if (newScreenname) {
    updateData.screenname = newScreenname;
    if (isScreennameChanging) {
      updateData.lastScreennameChange = new Date();
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: existingUser.id },
    data: updateData,
    include: { profile: { include: { socialActor: true } } },
  });

  // Sync screenname to SocialActor if one exists and screenname changed
  if (isScreennameChanging && updatedUser.profile?.socialActor) {
    const actor = updatedUser.profile.socialActor;
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
    data: formatUserResponse(updatedUser),
  });
}

function formatUserResponse(user: any) {
  return {
    _id: user.id,
    email: user.email,
    name: user.name,
    screenname: user.screenname,
    status: {
      role: user.role,
      locked: user.lockedAt,
    },
    affiliate: user.affiliate,
    alternate_emails: user.alternateEmails,
    zip_code: user.zipCode,
    accountType: user.accountType,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const maxDuration = 5;
