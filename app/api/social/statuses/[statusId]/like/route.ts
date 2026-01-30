/**
 * POST /api/social/statuses/[statusId]/like - Like a status
 * DELETE /api/social/statuses/[statusId]/like - Unlike a status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { likeStatus, unlikeStatus } from '@/lib/federation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ statusId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { statusId } = await params;

  const prisma = await getPrisma();

  // Get user's actor
  const profile = await prisma.profile.findFirst({
    where: { userId: session.user.id },
    include: { socialActor: true },
  });

  if (!profile?.socialActor) {
    return NextResponse.json(
      { success: false, error: 'You must enable social features first' },
      { status: 403 }
    );
  }

  const result = await likeStatus(profile.socialActor.id, statusId);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { liked: result.liked, likesCount: result.likesCount },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ statusId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { statusId } = await params;

  const prisma = await getPrisma();

  // Get user's actor
  const profile = await prisma.profile.findFirst({
    where: { userId: session.user.id },
    include: { socialActor: true },
  });

  if (!profile?.socialActor) {
    return NextResponse.json(
      { success: false, error: 'You must enable social features first' },
      { status: 403 }
    );
  }

  const result = await unlikeStatus(profile.socialActor.id, statusId);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { liked: result.liked, likesCount: result.likesCount },
  });
}
