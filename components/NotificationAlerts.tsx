/**
 * NotificationAlerts
 *
 * Ambient (renders nothing) unread-notification cues that live outside the
 * dropdown:
 *   1. Browser tab — prefixes document.title with the unread count, e.g.
 *      "(3) Pana MIA", and re-applies after client navigation (Next resets the
 *      title on route change).
 *   2. Desktop notification — when the unread count *increases* and the user
 *      has granted the Web Notifications permission, shows a native toast that
 *      deep-links to /updates.
 *
 * Mounted once from MainHeader (inside Providers, so react-query is available).
 */

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { useUnreadCount } from '@/lib/query/notifications';

// Strip a previously-applied "(n) " prefix before re-applying, so the count
// never stacks (e.g. "(2) (3) Pana MIA").
const COUNT_PREFIX = /^\(\d+\)\s+/;

export default function NotificationAlerts() {
  const { data: session } = useSession();
  const enabled = !!session?.user;
  const { data: unreadCount } = useUnreadCount({ enabled });
  const pathname = usePathname();
  // null until the first settled count, so we never fire a desktop notification
  // for notifications that already existed when the page loaded.
  const prevCountRef = useRef<number | null>(null);

  const count = unreadCount ?? 0;

  // Browser tab title. Depends on pathname so it re-applies after navigation.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const base = document.title.replace(COUNT_PREFIX, '');
    document.title = enabled && count > 0 ? `(${count}) ${base}` : base;
  }, [count, pathname, enabled]);

  // Desktop notification on increase.
  useEffect(() => {
    if (!enabled || unreadCount === undefined) {
      prevCountRef.current = null;
      return;
    }
    const prev = prevCountRef.current;
    prevCountRef.current = unreadCount;
    if (prev === null) return; // establish baseline without firing

    if (
      unreadCount > prev &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      const delta = unreadCount - prev;
      const notification = new Notification('Pana MIA', {
        body:
          delta === 1
            ? 'You have a new update.'
            : `You have ${delta} new updates.`,
        tag: 'pana-updates', // collapse rapid successive alerts
      });
      notification.onclick = () => {
        window.focus();
        window.location.href = '/updates';
        notification.close();
      };
    }
  }, [unreadCount, enabled]);

  return null;
}
