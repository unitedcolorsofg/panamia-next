import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users, profiles, screennameHistory, socialActors } from '@/lib/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { validateScreennameFull } from '@/lib/screenname';
import {
  addProfileOwner,
  notBusinessListing,
} from '@/lib/server/profile-owners';

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

  // Posts deliberately survive a handle change.
  //
  // This previously deleted every status the actor had authored. That was
  // silent, unwarned data loss - the `timelineReset` flag below was never read
  // by any UI - and it is indefensible for a business rebrand, where the back
  // catalogue is most of the value.
  //
  // Nothing has to be rewritten to keep those posts reachable:
  //   - the permalink route /p/[user]/[postId] resolves on postId alone and
  //     ignores the handle segment, so existing links keep working;
  //   - social_statuses.uri is an ActivityPub object id, and object ids are
  //     permanent by spec. Rewriting them would orphan every remote reply and
  //     like that points at the old id, so they are left alone on purpose;
  //   - the actor's own URIs are re-pointed below, and the old handle is
  //     archived to screenname_history above, which drives the 410 tombstone.

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
    //
    // Business listings are excluded: absorbing one would make this human *be*
    // the business and burn their single identity slot. They are administered
    // through profileOwners instead. See lib/server/profile-owners.ts.
    const unclaimed = await db.query.profiles.findFirst({
      where: and(
        eq(profiles.email, email),
        isNull(profiles.userId),
        notBusinessListing
      ),
      columns: { id: true },
    });

    if (unclaimed) {
      await db
        .update(profiles)
        .set({ userId: session.user.id })
        .where(eq(profiles.id, unclaimed.id));
      await addProfileOwner(unclaimed.id, session.user.id);
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

  // Mirror the handle onto the profile. Resolvers (webfinger, nostr.json, the
  // actor endpoint) read profiles.screenname, so leaving this stale would make
  // @name resolve to the old identity. Covers both branches above: userId is
  // set by now whether the profile was just claimed, just created, or already
  // existed.
  await db
    .update(profiles)
    .set({ screenname: newScreenname })
    .where(eq(profiles.userId, session.user.id));

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
      // Always false now - renaming no longer destroys the timeline. Retained
      // so existing callers keep a stable response shape.
      timelineReset: false,
    },
  });
}
