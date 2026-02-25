/**
 * Current User API
 *
 * Returns the current authenticated user's information
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        id: true,
        screenname: true,
        accountType: true,
        notificationPreferences: true,
      },
      with: {
        profile: {
          columns: {
            name: true,
          },
        },
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        _id: currentUser.id,
        screenname: currentUser.screenname,
        name: currentUser.profile?.name,
        accountType: currentUser.accountType,
        notificationPreferences: currentUser.notificationPreferences,
      },
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
