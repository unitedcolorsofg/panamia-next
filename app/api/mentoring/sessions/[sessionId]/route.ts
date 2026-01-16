import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import MentorSession from '@/lib/model/mentorSession';
import { getPrisma } from '@/lib/prisma';
import {
  updateSessionNotesSchema,
  cancelSessionSchema,
} from '@/lib/validations/session';
import { createNotification } from '@/lib/notifications';
import { getScheduleUrl } from '@/lib/mentoring';

// GET - Get session details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // Next.js 15: params is now a Promise
  const { sessionId } = await params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  const mentorSession = await MentorSession.findOne({
    sessionId: sessionId,
    $or: [
      { mentorEmail: session.user.email },
      { menteeEmail: session.user.email },
    ],
  });

  if (!mentorSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ session: mentorSession });
}

// PATCH - Update session (notes, status)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // Next.js 15: params is now a Promise
  const { sessionId } = await params;

  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  const body = await request.json();
  const { action } = body;

  if (action === 'update_notes') {
    const validation = updateSessionNotesSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const updated = await MentorSession.findOneAndUpdate(
      {
        sessionId: sessionId,
        $or: [
          { mentorEmail: session.user.email },
          { menteeEmail: session.user.email },
        ],
      },
      { notes: validation.data.notes },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: updated });
  }

  if (action === 'cancel') {
    const validation = cancelSessionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    // Find session first
    const mentorSession = await MentorSession.findOne({
      sessionId: sessionId,
      $or: [
        { mentorEmail: session.user.email },
        { menteeEmail: session.user.email },
      ],
    });

    if (!mentorSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Can only cancel pending or scheduled sessions
    if (!['pending', 'scheduled'].includes(mentorSession.status)) {
      return NextResponse.json(
        {
          error: `Cannot cancel a session with status: ${mentorSession.status}`,
        },
        { status: 400 }
      );
    }

    // Update session
    mentorSession.status = 'cancelled';
    mentorSession.cancelledAt = new Date();
    mentorSession.cancelledBy = session.user.email;
    mentorSession.cancelReason = validation.data.reason;
    await mentorSession.save();

    // Determine who to notify (the other party)
    const isMentor = mentorSession.mentorEmail === session.user.email;
    const otherPartyEmail = isMentor
      ? mentorSession.menteeEmail
      : mentorSession.mentorEmail;

    // Get the other party's userId from their profile
    const prisma = await getPrisma();
    const otherPartyProfile = await prisma.profile.findUnique({
      where: { email: otherPartyEmail },
      select: { userId: true },
    });

    if (otherPartyProfile?.userId) {
      await createNotification({
        type: 'Delete',
        actorId: session.user.id,
        targetId: otherPartyProfile.userId,
        context: 'mentoring',
        objectId: mentorSession._id.toString(),
        objectType: 'session',
        objectTitle: mentorSession.topic,
        objectUrl: getScheduleUrl(),
        message: `Session cancelled: ${validation.data.reason}`,
      });
    }

    return NextResponse.json({ session: mentorSession });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
