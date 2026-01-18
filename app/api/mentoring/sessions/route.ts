import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { ProfileMentoring } from '@/lib/interfaces';
import { createSessionSchema } from '@/lib/validations/session';
import { createNotification } from '@/lib/notifications';
import { getScheduleUrl } from '@/lib/mentoring';
import { nanoid } from 'nanoid';
import { SessionType, SessionStatus, Prisma } from '@prisma/client';

// GET - List sessions for current user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = await getPrisma();

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role'); // 'mentor' | 'mentee' | 'all'
  const status = searchParams.get('status'); // 'pending' | 'scheduled' | 'completed' | 'all'

  // Build where clause
  const where: Prisma.MentorSessionWhereInput = {};

  // Role filter
  if (role === 'mentor') {
    where.mentorEmail = session.user.email;
  } else if (role === 'mentee') {
    where.menteeEmail = session.user.email;
  } else {
    where.OR = [
      { mentorEmail: session.user.email },
      { menteeEmail: session.user.email },
    ];
  }

  // Status filter
  if (status && status !== 'all') {
    where.status = status as SessionStatus;
  }

  const sessions = await prisma.mentorSession.findMany({
    where,
    orderBy: { scheduledAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ sessions });
}

// POST - Create new session request (requires mentor confirmation)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = await getPrisma();

  const body = await request.json();
  const validation = createSessionSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error },
      { status: 400 }
    );
  }

  const { mentorEmail, scheduledAt, duration, topic, sessionType } =
    validation.data;

  // Verify mentor exists and has mentoring enabled
  const mentor = await prisma.profile.findUnique({
    where: { email: mentorEmail },
  });

  const mentoring = mentor?.mentoring as ProfileMentoring | null;
  if (!mentor || !mentoring?.enabled) {
    return NextResponse.json(
      { error: 'Mentor not found or mentoring not enabled' },
      { status: 404 }
    );
  }

  // Mentor must have a userId (linked to PostgreSQL auth)
  if (!mentor.userId) {
    return NextResponse.json(
      { error: 'Mentor account not properly configured' },
      { status: 400 }
    );
  }

  // Create session with unique ID for Pusher channel
  // Status is 'pending' until mentor accepts
  const sessionId = nanoid(16);
  const newSession = await prisma.mentorSession.create({
    data: {
      mentorEmail,
      menteeEmail: session.user.email,
      scheduledAt: new Date(scheduledAt),
      duration,
      topic,
      sessionType: sessionType as SessionType,
      sessionId,
      status: 'pending',
    },
  });

  // Notify mentor of the session request
  // actorId = mentee (current user), targetId = mentor
  await createNotification({
    type: 'Invite',
    actorId: session.user.id,
    targetId: mentor.userId,
    context: 'mentoring',
    objectId: newSession.id,
    objectType: 'session',
    objectTitle: topic,
    objectUrl: getScheduleUrl(),
  });

  return NextResponse.json({ session: newSession }, { status: 201 });
}
