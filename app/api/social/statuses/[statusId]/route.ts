/**
 * GET /api/social/statuses/[statusId] - Get a single status
 * DELETE /api/social/statuses/[statusId] - Delete a status (author only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { getStatusWithLikeStatus, deleteStatus } from '@/lib/federation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ statusId: string }> }
) {
  const { statusId } = await params;

  // Get viewer's actor if authenticated
  let viewerActorId: string | undefined;
  const session = await auth();

  if (session?.user?.id) {
    const prisma = await getPrisma();
    const profile = await prisma.profile.findFirst({
      where: { userId: session.user.id },
      include: { socialActor: true },
    });
    viewerActorId = profile?.socialActor?.id;
  }

  const status = await getStatusWithLikeStatus(statusId, viewerActorId);

  if (!status) {
    return NextResponse.json(
      { success: false, error: 'Status not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { status },
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

  const result = await deleteStatus(statusId, profile.socialActor.id);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      {
        status:
          result.error === 'Not authorized to delete this status' ? 403 : 400,
      }
    );
  }

  return NextResponse.json({
    success: true,
    data: { deleted: true },
  });
}
