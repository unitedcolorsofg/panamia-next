import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  users,
  screennameHistory,
  socialStatuses,
  socialActors,
} from '@/lib/schema';
import { eq } from 'drizzle-orm';
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

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: {
      profile: {
        columns: {},
        with: { socialActor: { columns: { id: true } } },
      },
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
    await db.insert(screennameHistory).values({
      screenname: existingUser.screenname,
      userId: existingUser.id,
      redirectTo: newScreenname,
    });
  }

  // Delete timeline if screenname is changing and user has social actor
  const actorId = existingUser.profile?.socialActor?.id;
  if (isScreennameChanging && actorId) {
    // Delete all statuses authored by this actor
    await db.delete(socialStatuses).where(eq(socialStatuses.actorId, actorId));

    // Reset status count
    await db
      .update(socialActors)
      .set({ statusCount: 0 })
      .where(eq(socialActors.id, actorId));
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

  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, existingUser.id))
    .returning();

  // Sync screenname to SocialActor if one exists and screenname changed
  if (isScreennameChanging && actorId) {
    const {
      getActorUrl,
      getInboxUrl,
      getOutboxUrl,
      getFollowersUrl,
      getFollowingUrl,
    } = await import('@/lib/federation');

    await db
      .update(socialActors)
      .set({
        username: newScreenname,
        uri: getActorUrl(newScreenname),
        inboxUrl: getInboxUrl(newScreenname),
        outboxUrl: getOutboxUrl(newScreenname),
        followersUrl: getFollowersUrl(newScreenname),
        followingUrl: getFollowingUrl(newScreenname),
      })
      .where(eq(socialActors.id, actorId));
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
