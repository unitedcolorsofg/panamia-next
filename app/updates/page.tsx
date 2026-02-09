/**
 * Updates Page
 *
 * Combines voice memo composer, messages (inbox/sent), and notifications.
 * Voice memos are direct messages shown in the Messages section.
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/services/timelines/
 */

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCheck,
  Bell,
  RefreshCw,
  Mic,
  Inbox,
  Send,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import NotificationItem from '@/components/NotificationItem';
import { VoiceMemoComposer } from '@/components/social/VoiceMemoComposer';
import { PostCard } from '@/components/social/PostCard';
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

type MainTab = 'messages' | 'notifications';
type MessageTab = 'inbox' | 'sent';
type NotificationFilter = 'all' | 'unread';

export default function UpdatesPage() {
  const { data: session } = useSession();
  const [mainTab, setMainTab] = useState<MainTab>('messages');
  const [messageTab, setMessageTab] = useState<MessageTab>('inbox');
  const [notificationFilter, setNotificationFilter] =
    useState<NotificationFilter>('all');
  const [notificationOffset, setNotificationOffset] = useState(0);
  const limit = 20;

  // Notifications queries
  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    refetch: refetchNotifications,
    isFetching: notificationsFetching,
  } = useNotifications({
    limit,
    offset: notificationOffset,
    unreadOnly: notificationFilter === 'unread',
  });

  // Messages queries
  const {
    data: inboxData,
    isLoading: inboxLoading,
    refetch: refetchInbox,
    isFetching: inboxFetching,
  } = useInboxMessages();

  const {
    data: sentData,
    isLoading: sentLoading,
    refetch: refetchSent,
    isFetching: sentFetching,
  } = useSentMessages();

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

  const handleRefresh = () => {
    if (mainTab === 'messages') {
      if (messageTab === 'inbox') {
        refetchInbox();
      } else {
        refetchSent();
      }
    } else {
      refetchNotifications();
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

  const isRefreshing =
    (mainTab === 'messages' && messageTab === 'inbox' && inboxFetching) ||
    (mainTab === 'messages' && messageTab === 'sent' && sentFetching) ||
    (mainTab === 'notifications' && notificationsFetching);

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

        {/* Main Tabs: Messages / Notifications */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Tabs
                value={mainTab}
                onValueChange={(v) => setMainTab(v as MainTab)}
              >
                <TabsList>
                  <TabsTrigger
                    value="messages"
                    className="flex items-center gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Messages
                  </TabsTrigger>
                  <TabsTrigger
                    value="notifications"
                    className="flex items-center gap-2"
                  >
                    <Bell className="h-4 w-4" />
                    Pana Updates
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw
                    className={`mr-1 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
                {mainTab === 'notifications' && hasUnread && (
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
            {mainTab === 'messages' ? (
              <MessagesContent
                messageTab={messageTab}
                setMessageTab={setMessageTab}
                inboxMessages={inboxMessages}
                sentMessages={sentMessages}
                inboxLoading={inboxLoading}
                sentLoading={sentLoading}
                onDeleteMessage={handleDeleteMessage}
                isDeleting={deletePost.isPending}
              />
            ) : (
              <NotificationsContent
                filter={notificationFilter}
                setFilter={setNotificationFilter}
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

function MessagesContent({
  messageTab,
  setMessageTab,
  inboxMessages,
  sentMessages,
  inboxLoading,
  sentLoading,
  onDeleteMessage,
  isDeleting,
}: {
  messageTab: MessageTab;
  setMessageTab: (tab: MessageTab) => void;
  inboxMessages: SocialStatusDisplay[];
  sentMessages: SocialStatusDisplay[];
  inboxLoading: boolean;
  sentLoading: boolean;
  onDeleteMessage: (statusId: string) => void;
  isDeleting: boolean;
}) {
  const messages = messageTab === 'inbox' ? inboxMessages : sentMessages;
  const isLoading = messageTab === 'inbox' ? inboxLoading : sentLoading;

  return (
    <>
      <Tabs
        value={messageTab}
        onValueChange={(v) => setMessageTab(v as MessageTab)}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="inbox" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Sent
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          {messageTab === 'inbox' ? (
            <>
              <Inbox className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
                No messages yet
              </p>
              <p className="mt-1 text-sm text-gray-500">
                When someone sends you a voice memo, it will appear here.
              </p>
            </>
          ) : (
            <>
              <Send className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
                No sent messages
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Voice memos you send will appear here.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((status) => (
            <div key={status.id} className="relative">
              <PostCard status={status} />
              {messageTab === 'sent' && (
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
      )}
    </>
  );
}

function NotificationsContent({
  filter,
  setFilter,
  notifications,
  isLoading,
  hasMore,
  isFetching,
  onMarkAsRead,
  onLoadMore,
}: {
  filter: NotificationFilter;
  setFilter: (filter: NotificationFilter) => void;
  notifications: any[];
  isLoading: boolean;
  hasMore: boolean;
  isFetching: boolean;
  onMarkAsRead: (id: string) => void;
  onLoadMore: () => void;
}) {
  return (
    <>
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as NotificationFilter)}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>
      </Tabs>

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
              onMarkAsRead={onMarkAsRead}
            />
          ))}

          {hasMore && (
            <div className="pt-4 text-center">
              <Button
                variant="outline"
                onClick={onLoadMore}
                disabled={isFetching}
              >
                {isFetching ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
