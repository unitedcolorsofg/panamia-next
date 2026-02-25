/**
 * GET /api/social/actors/[username] - Get actor by username
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import {
  getActorByScreenname,
  getFollowRelationship,
  socialConfig,
} from '@/lib/federation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const actor = await getActorByScreenname(username);

  if (!actor) {
    return NextResponse.json(
      { success: false, error: 'Actor not found' },
      { status: 404 }
    );
  }

  // Get viewer's actor if authenticated
  let viewerActorId: string | null = null;
  const session = await auth();

  if (session?.user?.id) {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
      with: { socialActor: true },
    });
    viewerActorId = profile?.socialActor?.id || null;
  }

  // Get follow relationship
  const relationship = await getFollowRelationship(viewerActorId, actor.id);

  return NextResponse.json({
    success: true,
    data: {
      actor: {
        id: actor.id,
        username: actor.username,
        domain: actor.domain,
        uri: actor.uri,
        name: actor.name,
        summary: actor.summary,
        iconUrl: actor.iconUrl,
        followingCount: actor.followingCount,
        followersCount: actor.followersCount,
        statusCount: actor.statusCount,
        createdAt: actor.createdAt,
      },
      isFollowing: relationship.isFollowing,
      isFollowedBy: relationship.isFollowedBy,
      isSelf: viewerActorId === actor.id,
    },
  });
}
