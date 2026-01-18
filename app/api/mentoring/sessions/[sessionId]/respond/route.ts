/**
 * Mentoring Session Respond API
 *
 * POST /api/mentoring/sessions/[sessionId]/respond
 * Accept or decline a mentoring session request.
 * Only the mentor can respond to session requests.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { respondSessionSchema } from '@/lib/validations/session';
import { createNotification } from '@/lib/notifications';
import { getSessionUrl, getScheduleUrl } from '@/lib/mentoring';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await params;

  const prisma = await getPrisma();

  const body = await request.json();
  const validation = respondSessionSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error },
      { status: 400 }
    );
  }

  const { action, reason } = validation.data;

  // Decline requires a reason
  if (action === 'decline' && !reason) {
    return NextResponse.json(
      { error: 'Reason is required when declining a session' },
      { status: 400 }
    );
  }

  // Find the session
  const mentorSession = await prisma.mentorSession.findUnique({
    where: { sessionId },
  });

  if (!mentorSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Only the mentor can respond
  if (mentorSession.mentorEmail !== session.user.email) {
    return NextResponse.json(
      { error: 'Only the mentor can respond to session requests' },
      { status: 403 }
    );
  }

  // Can only respond to pending sessions
  if (mentorSession.status !== 'pending') {
    return NextResponse.json(
      {
        error: `Cannot respond to a session with status: ${mentorSession.status}`,
      },
      { status: 400 }
    );
  }

  // Get mentee's userId from their profile
  const menteeProfile = await prisma.profile.findUnique({
    where: { email: mentorSession.menteeEmail },
    select: { userId: true },
  });

  if (!menteeProfile?.userId) {
    return NextResponse.json(
      { error: 'Mentee account not properly configured' },
      { status: 400 }
    );
  }

  // Update session based on action
  if (action === 'accept') {
    const updatedSession = await prisma.mentorSession.update({
      where: { id: mentorSession.id },
      data: { status: 'scheduled' },
    });

    // Notify mentee of acceptance
    // actorId = mentor (current user), targetId = mentee
    await createNotification({
      type: 'Accept',
      actorId: session.user.id,
      targetId: menteeProfile.userId,
      context: 'mentoring',
      objectId: updatedSession.id,
      objectType: 'session',
      objectTitle: updatedSession.topic,
      objectUrl: getSessionUrl(sessionId),
    });

    return NextResponse.json({
      success: true,
      message: 'Session accepted',
      session: updatedSession,
    });
  } else {
    // Decline
    const updatedSession = await prisma.mentorSession.update({
      where: { id: mentorSession.id },
      data: {
        status: 'declined',
        declinedAt: new Date(),
        declinedBy: session.user.email,
        declineReason: reason,
      },
    });

    // Notify mentee of decline
    // actorId = mentor (current user), targetId = mentee
    await createNotification({
      type: 'Reject',
      actorId: session.user.id,
      targetId: menteeProfile.userId,
      context: 'mentoring',
      objectId: updatedSession.id,
      objectType: 'session',
      objectTitle: updatedSession.topic,
      objectUrl: getScheduleUrl(),
      message: reason,
    });

    return NextResponse.json({
      success: true,
      message: 'Session declined',
      session: updatedSession,
    });
  }
}
