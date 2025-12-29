/**
 * NotificationDropdown Component
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * ActivityPub-shaped notification dropdown
 */

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCheck, Bell } from 'lucide-react';
import NotificationItem from './NotificationItem';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from '@/lib/query/notifications';

export default function NotificationDropdown() {
  const { data, isLoading } = useNotifications({ limit: 10 });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const notifications = data?.notifications || [];
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <DropdownMenuContent align="end" className="w-80">
      <div className="flex items-center justify-between px-2 py-1.5">
        <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={handleMarkAllAsRead}
            disabled={markAllAsRead.isPending}
          >
            <CheckCheck className="mr-1 h-3 w-3" />
            Mark all read
          </Button>
        )}
      </div>
      <DropdownMenuSeparator />

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Bell className="mb-2 h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No notifications yet
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-1">
            {notifications.map((notification: any) => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                compact
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <DropdownMenuSeparator />
      <div className="p-1">
        <Button variant="ghost" size="sm" className="w-full" asChild>
          <Link href="/account/notifications">View all notifications</Link>
        </Button>
      </div>
    </DropdownMenuContent>
  );
}
