/**
 * NotificationFlower Component
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * ActivityPub-shaped notification button (Pana flower icon)
 *
 * Displays in the header with unread notification count badge.
 * Clicking opens the NotificationDropdown.
 */

'use client';

import { Flower2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUnreadCount } from '@/lib/query/notifications';
import NotificationDropdown from './NotificationDropdown';

export default function NotificationFlower() {
  const { data: unreadCount = 0 } = useUnreadCount();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          data-no-wobble="true"
        >
          <Flower2 className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Notifications</span>

          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <NotificationDropdown />
    </DropdownMenu>
  );
}
