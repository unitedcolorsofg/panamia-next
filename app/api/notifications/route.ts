/**
 * Notifications API - List notifications
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * ActivityPub-shaped notification system
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';
import { getNotifications, getNotificationMessage } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    // Get user ID from email
    const currentUser = await user.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const context = searchParams.get('context') as string | undefined;

    const result = await getNotifications(currentUser._id.toString(), {
      limit,
      offset,
      unreadOnly,
      context: context as any,
    });

    // Add human-readable message to each notification
    const notificationsWithMessages = result.notifications.map(
      (notif: any) => ({
        ...notif,
        _id: notif._id.toString(),
        actor: notif.actor?.toString(),
        target: notif.target?.toString(),
        object: notif.object?.toString(),
        displayMessage: getNotificationMessage(notif),
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        notifications: notificationsWithMessages,
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
