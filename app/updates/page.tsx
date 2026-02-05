/**
 * Updates Page
 *
 * Combines notification history with voice memo composer.
 * Voice memos are posted to the social timeline.
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 */

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCheck, Bell, RefreshCw, Mic } from 'lucide-react';
import NotificationItem from '@/components/NotificationItem';
import { VoiceMemoComposer } from '@/components/social/VoiceMemoComposer';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from '@/lib/query/notifications';

type FilterType = 'all' | 'unread';

export default function UpdatesPage() {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<FilterType>('all');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading, refetch, isFetching } = useNotifications({
    limit,
    offset,
    unreadOnly: filter === 'unread',
  });

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const handleLoadMore = () => {
    setOffset((prev) => prev + limit);
  };

  const handleFilterChange = (value: string) => {
    setFilter(value as FilterType);
    setOffset(0);
  };

  if (!session) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              You must be logged in to view this page.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const notifications = data?.notifications || [];
  const hasMore = data?.hasMore || false;
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-6">
        {/* Voice Memo Composer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Voice Memo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VoiceMemoComposer />
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw
                    className={`mr-1 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
                {hasUnread && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    disabled={markAllAsRead.isPending}
                  >
                    <CheckCheck className="mr-1 h-4 w-4" />
                    Mark all read
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filter tabs */}
            <Tabs
              value={filter}
              onValueChange={handleFilterChange}
              className="mb-4"
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Notifications list */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="mb-3 h-12 w-12 text-gray-400" />
                <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
                  {filter === 'unread'
                    ? 'No unread notifications'
                    : 'No notifications yet'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {filter === 'unread'
                    ? "You're all caught up!"
                    : "When you receive notifications, they'll appear here."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification: any) => (
                  <NotificationItem
                    key={notification._id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                  />
                ))}

                {/* Load more button */}
                {hasMore && (
                  <div className="pt-4 text-center">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={isFetching}
                    >
                      {isFetching ? 'Loading...' : 'Load more'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
