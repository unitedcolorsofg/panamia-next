/**
 * GET /api/social/actors/me - Get current user's actor
 * POST /api/social/actors/me - Enable social features (create actor)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { createActorForProfile, canCreateSocialActor } from '@/lib/federation';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const prisma = await getPrisma();

  // Get user's profile with social actor, and user for screenname
  const profile = await prisma.profile.findFirst({
    where: { userId: session.user.id },
    include: { socialActor: true, user: true },
  });

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
      // Include screenname so UI can show what the social username will be
      screenname: profile.user?.screenname,
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

  const prisma = await getPrisma();

  // Get user's profile
  const profile = await prisma.profile.findFirst({
    where: { userId: session.user.id },
  });

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
