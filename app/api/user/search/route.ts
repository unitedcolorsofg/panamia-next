/**
 * User Search API - Search users by screenname
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Used for co-author and reviewer invitations
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';
import profile from '@/lib/model/profile';

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

    await dbConnect();

    // Get current user to exclude from results
    const currentUser = await user.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Search users by screenname (case-insensitive prefix match)
    const users = await user
      .find({
        _id: { $ne: currentUser._id },
        screenname: { $regex: `^${query}`, $options: 'i' },
      })
      .select('_id screenname name')
      .limit(limit)
      .lean();

    // Get profile info for verified badge
    const userIds = users.map((u: any) => u._id);
    const profiles = await profile
      .find({
        email: { $in: users.map((u: any) => u.email) },
        active: true,
      })
      .select('email panaVerified slug')
      .lean();

    // Create email to profile map
    const profileMap = new Map(
      profiles.map((p: any) => [
        p.email,
        { verified: p.panaVerified, slug: p.slug },
      ])
    );

    // Format response
    const formattedUsers = users.map((u: any) => {
      const profileInfo = profileMap.get(u.email);
      return {
        _id: u._id.toString(),
        screenname: u.screenname,
        name: u.name,
        verified: profileInfo?.verified || false,
        profileSlug: profileInfo?.slug,
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
