/**
 * User Search API - Search users by screenname
 *
 * UPSTREAM REFERENCE: external/activities.next/app/api/v1/accounts/search/
 * Used for co-author and reviewer invitations
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users, profiles } from '@/lib/schema';
import { eq, and, ne, ilike } from 'drizzle-orm';

/**
 * GET /api/user/search?q=screenname
 * Search users by screenname for invitations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = (request.nextUrl ?? new URL(request.url)).searchParams;
    const query = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20);

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        data: { users: [] },
      });
    }

    // Get current user to exclude from results
    const currentUser = await db.query.users.findFirst({
      where: eq(users.email, session.user.email),
    });
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Only surface users who can actually be invited: they must have an active
    // profile linked by userId (the same record the co-author/reviewer invite
    // routes require) and a screenname to match on. The INNER JOIN on
    // profiles.userId is what prevents the search box from offering users the
    // invite would then reject with "profile not found". verification comes from
    // the joined profile, so no second query is needed for the verified badge.
    const foundUsers = await db
      .select({
        id: users.id,
        screenname: users.screenname,
        verification: profiles.verification,
      })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(
        and(
          ne(users.id, currentUser.id),
          ilike(users.screenname, `${query}%`),
          eq(profiles.active, true)
        )
      )
      .limit(limit);

    // Format response - screenname comes from User, not Profile
    const formattedUsers = foundUsers.map((u) => {
      const verification = u.verification as { panaVerified?: boolean } | null;
      return {
        _id: u.id,
        screenname: u.screenname,
        verified: verification?.panaVerified || false,
      };
    });

    return NextResponse.json({
      success: true,
      data: { users: formattedUsers },
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search users' },
      { status: 500 }
    );
  }
}
