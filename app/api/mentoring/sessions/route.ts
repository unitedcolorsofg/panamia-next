import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import MentorSession from '@/lib/model/mentorSession';
import Profile from '@/lib/model/profile';
import user from '@/lib/model/user';
import { createSessionSchema } from '@/lib/validations/session';
import { createNotification } from '@/lib/notifications';
import { getScheduleUrl } from '@/lib/mentoring';
import { nanoid } from 'nanoid';

// GET - List sessions for current user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role'); // 'mentor' | 'mentee' | 'all'
  const status = searchParams.get('status'); // 'pending' | 'scheduled' | 'completed' | 'all'

  const query: Record<string, unknown> = {};

  // Role filter
  if (role === 'mentor') {
    query.mentorEmail = session.user.email;
  } else if (role === 'mentee') {
    query.menteeEmail = session.user.email;
  } else {
    query.$or = [
      { mentorEmail: session.user.email },
      { menteeEmail: session.user.email },
    ];
  }

  // Status filter
  if (status && status !== 'all') {
    query.status = status;
  }

  const sessions = await MentorSession.find(query)
    .sort({ scheduledAt: -1 })
    .limit(50);

  return NextResponse.json({ sessions });
}

// POST - Create new session request (requires mentor confirmation)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

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
  const mentor = await Profile.findOne({
    email: mentorEmail,
    'mentoring.enabled': true,
  });

  if (!mentor) {
    return NextResponse.json(
      { error: 'Mentor not found or mentoring not enabled' },
      { status: 404 }
    );
  }

  // Get user IDs for both parties
  const [mentorUser, menteeUser] = await Promise.all([
    user.findOne({ email: mentorEmail }).select('_id'),
    user.findOne({ email: session.user.email }).select('_id'),
  ]);

  if (!mentorUser || !menteeUser) {
    return NextResponse.json(
      { error: 'User accounts not found' },
      { status: 404 }
    );
  }

  // Create session with unique ID for Pusher channel
  // Status is 'pending' until mentor accepts
  const sessionId = nanoid(16);
  const newSession = await MentorSession.create({
    mentorEmail,
    menteeEmail: session.user.email,
    mentorUserId: mentorUser._id,
    menteeUserId: menteeUser._id,
    scheduledAt: new Date(scheduledAt),
    duration,
    topic,
    sessionType,
    sessionId,
    status: 'pending',
  });

  // Notify mentor of the session request
  await createNotification({
    type: 'Invite',
    actorId: menteeUser._id.toString(),
    targetId: mentorUser._id.toString(),
    context: 'mentoring',
    objectId: newSession._id.toString(),
    objectType: 'session',
    objectTitle: topic,
    objectUrl: getScheduleUrl(),
  });

  return NextResponse.json({ session: newSession }, { status: 201 });
}
