import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pusherServer } from '@/lib/pusher-server';
import { getPrisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.text();
  const params = new URLSearchParams(body);
  const socketId = params.get('socket_id');
  const channelName = params.get('channel_name');

  if (!socketId || !channelName) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // Validate user has access to this channel
  // Channel naming: private-session-{sessionId} or presence-session-{sessionId}
  const channelParts = channelName.split('-');
  const channelPrefix = channelParts[0];
  const channelType = channelParts[1];
  const resourceId = channelParts.slice(2).join('-');

  if (channelType === 'session') {
    // Verify user is participant in this session
    const prisma = await getPrisma();
    const mentorSession = await prisma.mentorSession.findFirst({
      where: {
        sessionId: resourceId,
        OR: [
          { mentorEmail: session.user.email },
          { menteeEmail: session.user.email },
        ],
      },
    });

    if (!mentorSession) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  // Authenticate for private channels
  if (channelPrefix === 'private') {
    const authResponse = pusherServer.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  }

  // Authenticate for presence channels
  if (channelPrefix === 'presence') {
    const presenceData = {
      user_id: session.user.email,
      user_info: {
        email: session.user.email,
      },
    };
    const authResponse = pusherServer.authorizeChannel(
      socketId,
      channelName,
      presenceData
    );
    return NextResponse.json(authResponse);
  }

  return NextResponse.json({ error: 'Invalid channel type' }, { status: 400 });
}
