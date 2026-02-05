/**
 * GET /api/social/statuses - Get public feed
 * POST /api/social/statuses - Create a new post
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { createStatus, getPublicTimeline } from '@/lib/federation';

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

  const result = await createStatus(
    profile.socialActor.id,
    content,
    contentWarning,
    inReplyTo,
    resolvedVisibility,
    Array.isArray(attachments) ? attachments : undefined,
    resolvedVisibility === 'direct' ? recipientActorIds : undefined
  );

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, gateResult: result.gateResult },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { status: result.status },
  });
}
