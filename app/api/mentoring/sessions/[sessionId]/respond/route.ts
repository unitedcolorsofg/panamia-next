/**
 * Mentoring Session Respond API
 *
 * POST /api/mentoring/sessions/[sessionId]/respond
 * Accept or decline a mentoring session request.
 * Only the mentor can respond to session requests.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import MentorSession from '@/lib/model/mentorSession';
import user from '@/lib/model/user';
import { respondSessionSchema } from '@/lib/validations/session';
import { createNotification } from '@/lib/notifications';
import { getSessionUrl, getScheduleUrl } from '@/lib/mentoring';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await params;

  await dbConnect();

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
  const mentorSession = await MentorSession.findOne({ sessionId });

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

  // Get current user (mentor) for notification
  const mentorUser = await user
    .findOne({ email: session.user.email })
    .select('_id');

  if (!mentorUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Update session based on action
  if (action === 'accept') {
    mentorSession.status = 'scheduled';
    await mentorSession.save();

    // Notify mentee of acceptance
    await createNotification({
      type: 'Accept',
      actorId: mentorUser._id.toString(),
      targetId: mentorSession.menteeUserId.toString(),
      context: 'mentoring',
      objectId: mentorSession._id.toString(),
      objectType: 'session',
      objectTitle: mentorSession.topic,
      objectUrl: getSessionUrl(sessionId),
    });

    return NextResponse.json({
      success: true,
      message: 'Session accepted',
      session: mentorSession,
    });
  } else {
    // Decline
    mentorSession.status = 'declined';
    mentorSession.declinedAt = new Date();
    mentorSession.declinedBy = session.user.email;
    mentorSession.declineReason = reason;
    await mentorSession.save();

    // Notify mentee of decline
    await createNotification({
      type: 'Reject',
      actorId: mentorUser._id.toString(),
      targetId: mentorSession.menteeUserId.toString(),
      context: 'mentoring',
      objectId: mentorSession._id.toString(),
      objectType: 'session',
      objectTitle: mentorSession.topic,
      objectUrl: getScheduleUrl(),
      message: reason,
    });

    return NextResponse.json({
      success: true,
      message: 'Session declined',
      session: mentorSession,
    });
  }
}
