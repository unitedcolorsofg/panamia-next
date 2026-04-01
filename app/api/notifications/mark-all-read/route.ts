/**
 * Notifications API - Mark all notifications as read
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/services/notifications/
 * ActivityPub-shaped notification system
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { markAllAsRead } from '@/lib/notifications';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const count = await markAllAsRead(session.user.id);

    return NextResponse.json({
      success: true,
      data: { markedCount: count },
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
