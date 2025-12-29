/**
 * Notification Helper Functions
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * See: lib/activities/actions/ for comparable patterns
 *
 * This module provides functions to create, query, and manage notifications
 * using an ActivityPub-shaped schema for future federation compatibility.
 */

import dbConnect from './connectdb';
import notification from './model/notification';
import user from './model/user';
import type {
  NotificationActivityType,
  NotificationContext,
} from './interfaces';

// Retention periods in milliseconds
const RETENTION = {
  INDEFINITE: null,
  DAYS_30: 30 * 24 * 60 * 60 * 1000,
  DAYS_90: 90 * 24 * 60 * 60 * 1000,
};

export interface CreateNotificationParams {
  type: NotificationActivityType;
  actorId: string; // userId of who triggered this
  targetId: string; // userId of who receives this
  context: NotificationContext;
  objectId?: string; // objectId (article, profile, etc.)
  objectType?: 'article' | 'profile' | 'session' | 'comment';
  objectTitle?: string;
  objectUrl?: string;
  message?: string; // Personal message (invitation text)
}

/**
 * Create a notification
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Maps to ActivityPub Activity creation pattern
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  await dbConnect();

  // Get actor info for denormalization
  const actorUser = await user
    .findById(params.actorId)
    .select('screenname name');

  // Determine expiration based on type and context
  const expiresAt = getExpirationDate(params.type, params.context);

  // Create notification
  await notification.create({
    type: params.type,
    actor: params.actorId,
    target: params.targetId,
    context: params.context,
    object: params.objectId,
    objectType: params.objectType,
    objectTitle: params.objectTitle,
    objectUrl: params.objectUrl,
    message: params.message,
    actorScreenname: actorUser?.screenname,
    actorName: actorUser?.name,
    read: false,
    emailSent: false,
    expiresAt,
  });

  // TODO: Check email preferences and send if enabled
  // await maybeSendNotificationEmail(notification);
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    context?: NotificationContext;
  } = {}
) {
  await dbConnect();

  const { limit = 20, offset = 0, unreadOnly = false, context } = options;

  const query: Record<string, unknown> = { target: userId };

  if (unreadOnly) {
    query.read = false;
  }

  if (context) {
    query.context = context;
  }

  const notifications = await notification
    .find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  const total = await notification.countDocuments(query);

  return {
    notifications,
    total,
    hasMore: offset + notifications.length < total,
  };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  await dbConnect();

  return await notification.countDocuments({
    target: userId,
    read: false,
  });
}

/**
 * Mark a notification as read
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  await dbConnect();

  const result = await notification.updateOne(
    { _id: notificationId, target: userId },
    { read: true, readAt: new Date() }
  );

  return result.modifiedCount > 0;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  await dbConnect();

  const result = await notification.updateMany(
    { target: userId, read: false },
    { read: true, readAt: new Date() }
  );

  return result.modifiedCount;
}

/**
 * Delete a notification (for user-initiated deletion)
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  await dbConnect();

  const result = await notification.deleteOne({
    _id: notificationId,
    target: userId,
  });

  return result.deletedCount > 0;
}

/**
 * Determine notification expiration based on type and context
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Retention policy aligned with ActivityPub patterns
 */
function getExpirationDate(
  type: NotificationActivityType,
  context: NotificationContext
): Date | null {
  // Invitations never expire (audit trail)
  if (type === 'Invite' || type === 'Accept' || type === 'Reject') {
    return null;
  }

  // System announcements expire after 30 days
  if (context === 'system') {
    return new Date(Date.now() + RETENTION.DAYS_30!);
  }

  // Article lifecycle expires after 90 days
  if (context === 'article' || context === 'coauthor' || context === 'review') {
    return new Date(Date.now() + RETENTION.DAYS_90!);
  }

  // Mentoring notifications expire after 90 days
  if (context === 'mentoring') {
    return new Date(Date.now() + RETENTION.DAYS_90!);
  }

  // Social (follow, mention) expires after 30 days
  return new Date(Date.now() + RETENTION.DAYS_30!);
}

/**
 * Get human-readable notification message
 */
export function getNotificationMessage(notif: {
  type: NotificationActivityType;
  context: NotificationContext;
  actorScreenname?: string;
  actorName?: string;
  objectTitle?: string;
  message?: string;
}): string {
  const actor = notif.actorScreenname || notif.actorName || 'Someone';
  const object = notif.objectTitle || 'content';

  switch (notif.context) {
    case 'coauthor':
      if (notif.type === 'Invite') {
        return `${actor} invited you to co-author "${object}"`;
      }
      if (notif.type === 'Accept') {
        return `${actor} accepted your co-author invitation for "${object}"`;
      }
      if (notif.type === 'Reject') {
        return `${actor} declined your co-author invitation for "${object}"`;
      }
      break;

    case 'review':
      if (notif.type === 'Invite') {
        return `${actor} requested your review of "${object}"`;
      }
      if (notif.type === 'Accept') {
        return `${actor} approved "${object}"`;
      }
      if (notif.type === 'Update') {
        return `${actor} requested revisions to "${object}"`;
      }
      break;

    case 'article':
      if (notif.type === 'Create') {
        return `${actor} published "${object}"`;
      }
      if (notif.type === 'Delete') {
        return `"${object}" was removed`;
      }
      break;

    case 'mentoring':
      if (notif.type === 'Invite') {
        return `${actor} requested a mentoring session`;
      }
      if (notif.type === 'Accept') {
        return `${actor} accepted your mentoring request`;
      }
      if (notif.type === 'Reject') {
        return `${actor} declined your mentoring request`;
      }
      break;

    case 'follow':
      if (notif.type === 'Follow') {
        return `${actor} started following you`;
      }
      break;

    case 'system':
      return notif.message || 'System notification';
  }

  // Fallback
  return notif.message || `${actor} performed an action`;
}
