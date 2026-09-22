/**
 * GET /api/social/actors/me - Get current user's actor
 * POST /api/social/actors/me - Enable social features (create actor)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { createActorForProfile, canCreateSocialActor } from '@/lib/federation';
import {
  getActiveProfile,
  getActiveProfileId,
} from '@/lib/server/active-profile';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // The profile being acted as, with its actor and linked user (for screenname)
  const activeId = await getActiveProfileId(session.user.id);
  const profile = activeId
    ? await db.query.profiles.findFirst({
        where: eq(profiles.id, activeId),
        with: { socialActor: true, user: true },
      })
    : null;

  if (!profile) {
    return NextResponse.json({
      success: true,
      data: {
        actor: null,
        eligible: false,
        reason: 'No profile found',
      },
    });
  }

  const gateResult = canCreateSocialActor(profile);

  return NextResponse.json({
    success: true,
    data: {
      actor: profile.socialActor,
      eligible: gateResult.allowed,
      reason: gateResult.reason,
      // Include screenname so UI can show what the social username will be.
      // Profile-first: a business listing owns its handle and has no user.
      screenname: profile.screenname ?? profile.user?.screenname,
      profileId: profile.id,
      profileName: profile.name,
    },
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Enable social for whoever they're acting as, so a business listing can be
  // given its own actor by an owner who already has one personally.
  const profile = await getActiveProfile(session.user.id);

  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'No profile found' },
      { status: 400 }
    );
  }

  const result = await createActorForProfile(profile.id);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, gateResult: result.gateResult },
      { status: 403 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { actor: result.actor },
  });
}
