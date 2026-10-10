/**
 * GET /api/social/messages/conversations - the DM conversation list
 *
 * One row per person the viewer has a thread with, newest activity first.
 * This is the chat view's left pane. /inbox and /sent remain the flat mail
 * lists and are not retired until the chat view reaches parity.
 *
 * @see docs/CHAT-ROADMAP.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { getDirectConversations, socialConfig } from '@/lib/federation';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const profile = await getActiveProfileWithActor(session.user.id);

  // An account with no actor has no conversations, which is an empty list
  // rather than an error -- the same answer /inbox gives, so a member who has
  // not finished onboarding sees an empty chat view instead of a failure.
  if (!profile?.socialActor) {
    return NextResponse.json({
      success: true,
      data: {
        conversations: [],
        viewerActorId: null,
        localDomain: socialConfig.domain,
      },
    });
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') || '40'), 100);

  const conversations = await getDirectConversations(
    profile.socialActor.id,
    limit
  );

  return NextResponse.json({
    success: true,
    data: {
      conversations,
      // The viewer's own actor id travels with the list so the client can say
      // "You: ..." on a snippet without a second round trip to find out who it
      // is. It is the id of the session that asked, so it discloses nothing.
      viewerActorId: profile.socialActor.id,
      // Which domain counts as "here". The client needs it to decide whether a
      // counterparty is federated, and nothing client-side knows it otherwise
      // -- socialConfig is server-only, and the web host is not necessarily the
      // social domain. It is public either way; it is in every actor URI.
      localDomain: socialConfig.domain,
    },
  });
}
