/**
 * GET /api/social/statuses - Get public feed
 * POST /api/social/statuses - Create a new post
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { createStatus, getPublicTimeline } from '@/lib/federation';
import { createNotification } from '@/lib/notifications';

export async function GET(request: NextRequest) {
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

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get('cursor') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  const result = await getPublicTimeline(viewerActorId, cursor, limit);

  return NextResponse.json({
    success: true,
    data: result,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const {
    content,
    contentWarning,
    inReplyTo,
    visibility,
    attachments,
    recipientActorIds,
    location,
  } = body;

  if (!content || typeof content !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Content is required' },
      { status: 400 }
    );
  }

  // Validate visibility if provided
  const validVisibilities = [
    'public',
    'unlisted',
    'private',
    'direct',
  ] as const;
  const resolvedVisibility =
    visibility && validVisibilities.includes(visibility)
      ? visibility
      : 'unlisted';

  // Direct messages require recipientActorIds
  if (resolvedVisibility === 'direct') {
    if (!Array.isArray(recipientActorIds) || recipientActorIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Direct messages require at least one recipient',
        },
        { status: 400 }
      );
    }
  }

  // Validate location if provided
  let validatedLocation = undefined;
  if (location && typeof location === 'object') {
    const hasCoordinates =
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number' &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180;
    const hasName =
      typeof location.name === 'string' && location.name.trim().length > 0;

    // Accept locations with coordinates OR name (or both)
    if (hasCoordinates || hasName) {
      validatedLocation = {
        type: 'Place' as const,
        ...(hasCoordinates && {
          latitude: location.latitude,
          longitude: location.longitude,
        }),
        ...(hasName && { name: location.name.trim() }),
        ...(location.precision === 'precise' || location.precision === 'general'
          ? { precision: location.precision }
          : {}),
      };
    }
  }

  const result = await createStatus(
    profile.socialActor.id,
    content,
    contentWarning,
    inReplyTo,
    resolvedVisibility,
    Array.isArray(attachments) ? attachments : undefined,
    resolvedVisibility === 'direct' ? recipientActorIds : undefined,
    validatedLocation
  );

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, gateResult: result.gateResult },
      { status: 400 }
    );
  }

  // Create notifications for DM recipients
  if (resolvedVisibility === 'direct' && recipientActorIds?.length > 0) {
    // Look up recipient actors to get their user IDs
    const recipientActors = await prisma.socialActor.findMany({
      where: { id: { in: recipientActorIds } },
      include: { profile: { include: { user: true } } },
    });

    // Create a notification for each recipient
    for (const recipientActor of recipientActors) {
      const recipientUserId = recipientActor.profile?.userId;
      if (recipientUserId) {
        await createNotification({
          type: 'Create',
          actorId: session.user.id,
          targetId: recipientUserId,
          context: 'message',
          objectId: result.status?.id,
          objectUrl: `/updates`,
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: { status: result.status },
  });
}
