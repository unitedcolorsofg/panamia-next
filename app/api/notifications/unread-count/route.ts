/**
 * Notifications API - Get unread count
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/services/notifications/
 * ActivityPub-shaped notification system
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUnreadCount } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const count = await getUnreadCount(session.user.id);

    return NextResponse.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
