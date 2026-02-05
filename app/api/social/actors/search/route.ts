/**
 * GET /api/social/actors/search - Search for actors by username
 *
 * Used for @-mention autocomplete in the voice memo composer.
 * Returns local actors matching the query string.
 *
 * Query params:
 *   q: search query (min 1 char)
 *   limit: max results (default 10, max 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() || '';
  const limitParam = parseInt(searchParams.get('limit') || '10', 10);
  const limit = Math.min(Math.max(limitParam, 1), 20);

  if (query.length < 1) {
    return NextResponse.json({
      success: true,
      data: [],
    });
  }

  const prisma = await getPrisma();

  // Search local actors by username (case-insensitive)
  // Only return actors that have a linked profile (local users with social enabled)
  // Includes current user (allows sending voice memos to yourself)
  const actors = await prisma.socialActor.findMany({
    where: {
      profileId: { not: null },
      // Case-insensitive username search
      username: {
        contains: query,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      username: true,
      name: true,
      iconUrl: true,
      uri: true,
    },
    orderBy: {
      username: 'asc',
    },
    take: limit,
  });

  return NextResponse.json({
    success: true,
    data: actors.map((actor) => ({
      id: actor.id,
      username: actor.username,
      displayName: actor.name || actor.username,
      avatarUrl: actor.iconUrl,
      uri: actor.uri,
    })),
  });
}
