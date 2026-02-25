/**
 * Notification Helper Functions
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/services/notifications/
 * See: lib/activities/actions/ for comparable patterns
 *
 * This module provides functions to create, query, and manage notifications
 * using an ActivityPub-shaped schema for future federation compatibility.
 *
 * Storage: PostgreSQL via Drizzle ORM
 * Actor info: Fetched from PostgreSQL profile (denormalized at creation time)
 */

import { db } from '@/lib/db';
import { profiles, notifications } from '@/lib/schema';
import type {
  NotificationActivityType,
  NotificationContext,
} from './interfaces';
import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';

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
 * UPSTREAM REFERENCE: external/activities.next/lib/services/notifications/
 * Maps to ActivityPub Activity creation pattern
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  // Get actor info from profile for denormalization
  const actorProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, params.actorId),
    with: { user: { columns: { screenname: true } } },
  });

  // Determine expiration based on type and context
  const expiresAt = getExpirationDate(params.type, params.context);

  // Create notification
  await db.insert(notifications).values({
    type: params.type,
    actor: params.actorId,
    target: params.targetId,
    context: params.context,
    object: params.objectId,
    objectType: params.objectType,
    objectTitle: params.objectTitle,
    objectUrl: params.objectUrl,
    message: params.message,
    actorScreenname: actorProfile?.user?.screenname,
    actorName: actorProfile?.name,
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
  const { limit = 20, offset = 0, unreadOnly = false, context } = options;

  const conditions = [
    eq(notifications.target, userId),
    ...(unreadOnly ? [eq(notifications.read, false)] : []),
    ...(context ? [eq(notifications.context, context)] : []),
  ];

  const whereClause = and(...conditions);

  const [notificationsList, [{ count }]] = await Promise.all([
    db.query.notifications.findMany({
      where: whereClause,
      orderBy: (n, { desc }) => [desc(n.createdAt)],
      offset,
      limit,
    }),
    db
      .select({ count: sql<string>`count(*)` })
      .from(notifications)
      .where(whereClause),
  ]);

  const total = Number(count);

  return {
    notifications: notificationsList,
    total,
    hasMore: offset + notificationsList.length < total,
  };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<string>`count(*)` })
    .from(notifications)
    .where(
      and(eq(notifications.target, userId), eq(notifications.read, false))
    );

  return Number(count);
}

/**
 * Mark a notification as read
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const updated = await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.target, userId)
      )
    )
    .returning({ id: notifications.id });

  return updated.length > 0;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notifications.target, userId), eq(notifications.read, false)))
    .returning({ id: notifications.id });

  return updated.length;
}

/**
 * Delete a notification (for user-initiated deletion)
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const deleted = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.target, userId)
      )
    )
    .returning({ id: notifications.id });

  return deleted.length > 0;
}

/**
 * Clean up expired notifications
 * Call this periodically (e.g., via cron job)
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  const deleted = await db
    .delete(notifications)
    .where(lt(notifications.expiresAt, new Date()))
    .returning({ id: notifications.id });

  return deleted.length;
}

/**
 * Determine notification expiration based on type and context
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/services/notifications/
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

  // Direct messages expire after 30 days (notification only, not the message itself)
  if (context === 'message') {
    return new Date(Date.now() + RETENTION.DAYS_30!);
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

    case 'message':
      if (notif.type === 'Create') {
        return `${actor} sent you a voice memo`;
      }
      break;

    case 'system':
      return notif.message || 'System notification';
  }

  // Fallback
  return notif.message || `${actor} performed an action`;
}
