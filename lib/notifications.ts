/**
 * Notification Helper Functions
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * See: lib/activities/actions/ for comparable patterns
 *
 * This module provides functions to create, query, and manage notifications
 * using an ActivityPub-shaped schema for future federation compatibility.
 *
 * Storage: PostgreSQL via Prisma
 * Actor info: Fetched from MongoDB profile (denormalized at creation time)
 */

import { getPrismaSync } from './prisma';
import dbConnect from './connectdb';
import profile from './model/profile';
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
  actorId: string; // PostgreSQL User.id who triggered this
  targetId: string; // PostgreSQL User.id who receives this
  context: NotificationContext;
  objectId?: string; // MongoDB ObjectId as string (article, session, etc.)
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
  const prisma = getPrismaSync();

  // Get actor info from MongoDB profile for denormalization
  await dbConnect();
  const actorProfile = await (profile as any).findOne({
    userId: params.actorId,
  });

  // Determine expiration based on type and context
  const expiresAt = getExpirationDate(params.type, params.context);

  // Create notification
  await prisma.notification.create({
    data: {
      type: params.type,
      actor: params.actorId,
      target: params.targetId,
      context: params.context,
      object: params.objectId,
      objectType: params.objectType,
      objectTitle: params.objectTitle,
      objectUrl: params.objectUrl,
      message: params.message,
      actorScreenname: actorProfile?.slug,
      actorName: actorProfile?.name,
      read: false,
      emailSent: false,
      expiresAt,
    },
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
  const prisma = getPrismaSync();
  const { limit = 20, offset = 0, unreadOnly = false, context } = options;

  const where: any = { target: userId };

  if (unreadOnly) {
    where.read = false;
  }

  if (context) {
    where.context = context;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

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
  const prisma = getPrismaSync();

  return await prisma.notification.count({
    where: {
      target: userId,
      read: false,
    },
  });
}

/**
 * Mark a notification as read
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const prisma = getPrismaSync();

  const result = await prisma.notification.updateMany({
    where: { id: notificationId, target: userId },
    data: { read: true, readAt: new Date() },
  });

  return result.count > 0;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const prisma = getPrismaSync();

  const result = await prisma.notification.updateMany({
    where: { target: userId, read: false },
    data: { read: true, readAt: new Date() },
  });

  return result.count;
}

/**
 * Delete a notification (for user-initiated deletion)
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const prisma = getPrismaSync();

  const result = await prisma.notification.deleteMany({
    where: {
      id: notificationId,
      target: userId,
    },
  });

  return result.count > 0;
}

/**
 * Clean up expired notifications
 * Call this periodically (e.g., via cron job)
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  const prisma = getPrismaSync();

  const result = await prisma.notification.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
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
  actorScreenname?: string | null;
  actorName?: string | null;
  objectTitle?: string | null;
  message?: string | null;
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
        return `${actor} requested a mentoring session: "${object}"`;
      }
      if (notif.type === 'Accept') {
        return `${actor} accepted your mentoring session request`;
      }
      if (notif.type === 'Reject') {
        return `${actor} declined your mentoring session request`;
      }
      if (notif.type === 'Delete') {
        return notif.message || `${actor} cancelled the mentoring session`;
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
