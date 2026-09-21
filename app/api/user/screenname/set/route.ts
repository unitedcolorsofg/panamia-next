import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  users,
  profiles,
  screennameHistory,
  socialStatuses,
  socialActors,
} from '@/lib/schema';
import { and, eq, isNull } from 'drizzle-orm';
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

  const newScreenname = screenname.trim();

  // Fetch current user state including rate limit check
  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { screenname: true, lastScreennameChange: true },
    with: {
      profile: {
        columns: { id: true },
        with: { socialActor: { columns: { id: true } } },
      },
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
    await db.insert(screennameHistory).values({
      screenname: currentUser.screenname,
      userId: session.user.id,
      redirectTo: newScreenname,
    });
  }

  // If social actor exists, delete all their statuses (timeline + DMs reset)
  const hasSocialActor = !!currentUser?.profile?.socialActor;
  if (hasSocialActor) {
    const actorId = currentUser.profile!.socialActor!.id;

    // Delete all statuses authored by this actor
    await db.delete(socialStatuses).where(eq(socialStatuses.actorId, actorId));

    // Reset status count
    await db
      .update(socialActors)
      .set({ statusCount: 0 })
      .where(eq(socialActors.id, actorId));
  }

  // Update user screenname and record change timestamp
  const [updatedUser] = await db
    .update(users)
    .set({
      screenname: newScreenname,
      lastScreennameChange: currentUser?.screenname ? new Date() : undefined,
    })
    .where(eq(users.id, session.user.id))
    .returning({ screenname: users.screenname });

  // Every personal account gets a profile here. A profile is the platform's
  // social identity — social_actors references profiles, so without one a user
  // can browse but can never post, follow, or be followed.
  //
  // Screenname assignment is the earliest point this is possible:
  // profiles.name is NOT NULL while users.name is nullable (magic-link signups
  // often have no name), and the screenname supplies a guaranteed fallback.
  //
  // This does NOT put anyone in the directory. Directory and sitemap listing is
  // filtered on users.accountType, which defaults to 'personal'; only
  // small_business and hybrid are published.
  if (!currentUser?.profile) {
    // An unclaimed profile may already exist for this email — a listing created
    // before the account existed. auth.ts claims those at sign-in, but re-check
    // here so we can never trip the unique constraint on profiles.email.
    const unclaimed = await db.query.profiles.findFirst({
      where: and(eq(profiles.email, email), isNull(profiles.userId)),
      columns: { id: true },
    });

    if (unclaimed) {
      await db
        .update(profiles)
        .set({ userId: session.user.id })
        .where(eq(profiles.id, unclaimed.id));
    } else {
      await db.insert(profiles).values({
        userId: session.user.id,
        email,
        name: session.user.name?.trim() || newScreenname,
        // Consistent with createExpressProfile: self-created profiles are
        // active immediately. Visibility is governed by accountType, not this.
        active: true,
      });
    }
  }

  // Sync screenname to SocialActor if one exists
  const socialActorId = currentUser?.profile?.socialActor?.id;
  if (socialActorId) {
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
      .where(eq(socialActors.id, socialActorId));
  }

  return NextResponse.json({
    success: true,
    data: {
      screenname: updatedUser.screenname,
      timelineReset: hasSocialActor && !!currentUser?.screenname,
    },
  });
}
