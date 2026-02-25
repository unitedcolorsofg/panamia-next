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
import { eq, and, ne, ilike, inArray } from 'drizzle-orm';
import { ProfileMentoring } from '@/lib/interfaces';

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

    const searchParams = request.nextUrl.searchParams;
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

    // Search users by screenname (case-insensitive prefix match)
    const foundUsers = await db.query.users.findMany({
      where: and(
        ne(users.id, currentUser.id),
        ilike(users.screenname, `${query}%`)
      ),
      columns: { id: true, screenname: true, email: true },
      limit,
    });

    // Get profile info for verified badge
    const emails = foundUsers.map((u) => u.email);
    const foundProfiles =
      emails.length > 0
        ? await db.query.profiles.findMany({
            where: and(
              inArray(profiles.email, emails),
              eq(profiles.active, true)
            ),
            columns: { email: true, verification: true },
          })
        : [];

    // Create email to verification map
    const profileMap = new Map(
      foundProfiles.map((p) => {
        const verification = p.verification as {
          panaVerified?: boolean;
        } | null;
        return [p.email, { verified: verification?.panaVerified || false }];
      })
    );

    // Format response - screenname comes from User, not Profile
    const formattedUsers = foundUsers.map((u) => {
      const profileInfo = profileMap.get(u.email);
      return {
        _id: u.id,
        screenname: u.screenname,
        verified: profileInfo?.verified || false,
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
