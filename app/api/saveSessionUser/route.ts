import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users, screennameHistory, socialActors, profiles } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { notBusinessListing } from '@/lib/server/profile-owners';
import { validateScreennameFull } from '@/lib/screenname';
import type { User } from '@/lib/schema';

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

  const { name, screenname } = body;

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

  // Posts deliberately survive a handle change. This route used to carry an
  // identical destructive block to the one removed from
  // app/api/user/screenname/set/route.ts - see the long note there for why
  // statuses and their ActivityPub object ids are now left intact.
  const actorId = existingUser.profile?.socialActor?.id;

  // Build update data
  const updateData: {
    name?: string;
    screenname?: string;
    lastScreennameChange?: Date;
  } = {};
  if (name) {
    updateData.name = name;
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

  // Mirror identity onto the personal profile.
  //
  // profiles carries its own name and screenname, and it — not the users row —
  // is what the account menu, posts, and listings render. Leaving it stale is
  // why a member could set a name here and still see their handle everywhere
  // else: profiles.name is NOT NULL, so it gets a screenname fallback at
  // creation time and nothing ever revised it.
  //
  // The screenname matters for more than labels. Webfinger, nostr.json, and
  // the actor endpoint all resolve on profiles.screenname, so a handle change
  // that stopped at the users row would leave @name pointing at the old
  // identity. app/api/user/screenname/set/route.ts has always mirrored for
  // exactly that reason; this route is the other half of the same story.
  //
  // notBusinessListing guards a legacy shape: a business welded to
  // profiles.userId instead of profile_owners (see scripts/audit-profile-
  // claims.ts). Without it, renaming yourself would rename the business.
  const profileUpdate: { name?: string; screenname?: string } = {};
  const mirroredName = typeof name === 'string' ? name.trim() : '';
  if (mirroredName) {
    profileUpdate.name = mirroredName;
  }
  if (newScreenname) {
    profileUpdate.screenname = newScreenname;
  }

  if (Object.keys(profileUpdate).length > 0) {
    await db
      .update(profiles)
      .set(profileUpdate)
      .where(and(eq(profiles.userId, existingUser.id), notBusinessListing));
  }

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

function formatUserResponse(user: User) {
  return {
    _id: user.id,
    email: user.email,
    name: user.name,
    screenname: user.screenname,
    status: {
      locked: user.lockedAt,
    },
    affiliate: user.affiliate,
    alternate_emails: user.alternateEmails,
    accountType: user.accountType,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
