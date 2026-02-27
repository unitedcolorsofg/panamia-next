/**
 * Updates Page
 *
 * Combines voice memo composer, messages (@-me/sent), and notifications (Pana Updates).
 * Voice memos are direct messages shown in the Messages section.
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/services/timelines/
 */

'use client';

import { useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCheck, Bell, Mic, Inbox, Send, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import NotificationItem from '@/components/NotificationItem';
import { PostCard } from '@/components/social/PostCard';

const VoiceMemoComposer = dynamic(
  () =>
    import('@/components/social/VoiceMemoComposer').then((m) => ({
      default: m.VoiceMemoComposer,
    })),
  { ssr: false }
);
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from '@/lib/query/notifications';
import {
  useInboxMessages,
  useSentMessages,
  useDeletePost,
} from '@/lib/query/social';
import { SocialStatusDisplay } from '@/lib/interfaces';

type ActiveTab = 'at-me' | 'sent' | 'pana-updates';

export default function UpdatesPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<ActiveTab>('at-me');
  const [notificationOffset, setNotificationOffset] = useState(0);
  const limit = 20;

  // Notifications query (single stream, no filter)
  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    isFetching: notificationsFetching,
  } = useNotifications({
    limit,
    offset: notificationOffset,
    unreadOnly: false,
  });

  // Messages queries
  const { data: inboxData, isLoading: inboxLoading } = useInboxMessages();

  const { data: sentData, isLoading: sentLoading } = useSentMessages();

  const deletePost = useDeletePost();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const handleLoadMoreNotifications = () => {
    setNotificationOffset((prev) => prev + limit);
  };

  const handleDeleteMessage = (statusId: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      deletePost.mutate(statusId);
    }
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

  const notifications = notificationsData?.notifications || [];
  const hasMoreNotifications = notificationsData?.hasMore || false;
  const hasUnread = notifications.some((n) => !n.read);

  const inboxMessages = inboxData?.statuses || [];
  const sentMessages = sentData?.statuses || [];

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

        {/* Main Content Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as ActiveTab)}
              >
                <TabsList>
                  <TabsTrigger
                    value="at-me"
                    className="flex items-center gap-2"
                  >
                    <Inbox className="h-4 w-4" />
                    @-me
                  </TabsTrigger>
                  <TabsTrigger value="sent" className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Sent
                  </TabsTrigger>
                  <TabsTrigger
                    value="pana-updates"
                    className="flex items-center gap-2"
                  >
                    <Bell className="h-4 w-4" />
                    Pana Updates
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {activeTab === 'pana-updates' && hasUnread && (
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
          </CardHeader>
          <CardContent>
            {activeTab === 'at-me' && (
              <MessagesSection
                messages={inboxMessages}
                isLoading={inboxLoading}
                emptyIcon={<Inbox className="mb-3 h-12 w-12 text-gray-400" />}
                emptyTitle="No messages yet"
                emptyDescription="When someone sends you a voice memo, it will appear here."
              />
            )}
            {activeTab === 'sent' && (
              <MessagesSection
                messages={sentMessages}
                isLoading={sentLoading}
                emptyIcon={<Send className="mb-3 h-12 w-12 text-gray-400" />}
                emptyTitle="No sent messages"
                emptyDescription="Voice memos you send will appear here."
                showDelete
                onDeleteMessage={handleDeleteMessage}
                isDeleting={deletePost.isPending}
              />
            )}
            {activeTab === 'pana-updates' && (
              <NotificationsSection
                notifications={notifications}
                isLoading={notificationsLoading}
                hasMore={hasMoreNotifications}
                isFetching={notificationsFetching}
                onMarkAsRead={handleMarkAsRead}
                onLoadMore={handleLoadMoreNotifications}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function MessagesSection({
  messages,
  isLoading,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  showDelete = false,
  onDeleteMessage,
  isDeleting = false,
}: {
  messages: SocialStatusDisplay[];
  isLoading: boolean;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  showDelete?: boolean;
  onDeleteMessage?: (statusId: string) => void;
  isDeleting?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        {emptyIcon}
        <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
          {emptyTitle}
        </p>
        <p className="mt-1 text-sm text-gray-500">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((status) => (
        <div key={status.id} className="relative">
          <PostCard status={status} />
          {showDelete && onDeleteMessage && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
              onClick={() => onDeleteMessage(status.id)}
              disabled={isDeleting}
              title="Delete message"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function NotificationsSection({
  notifications,
  isLoading,
  hasMore,
  isFetching,
  onMarkAsRead,
  onLoadMore,
}: {
  notifications: any[];
  isLoading: boolean;
  hasMore: boolean;
  isFetching: boolean;
  onMarkAsRead: (id: string) => void;
  onLoadMore: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bell className="mb-3 h-12 w-12 text-gray-400" />
        <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
          No notifications yet
        </p>
        <p className="mt-1 text-sm text-gray-500">
          When you receive notifications, they&apos;ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((notification: any) => (
        <NotificationItem
          key={notification._id}
          notification={notification}
          onMarkAsRead={onMarkAsRead}
        />
      ))}

      {hasMore && (
        <div className="pt-4 text-center">
          <Button variant="outline" onClick={onLoadMore} disabled={isFetching}>
            {isFetching ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
