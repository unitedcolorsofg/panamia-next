/**
 * Messages — the DM chat view.
 *
 * Replaces the mail-shaped reading of DMs that /updates offers (an Inbox tab
 * and a Sent tab, each a flat list of statuses, with no conversation anywhere)
 * with a transcript. The substrate underneath is unchanged: these are still
 * socialStatuses rows addressed to one recipient and stamped with a 30-day
 * expiry, which is why the chat has to render things no generic messenger
 * does -- per-message countdowns, a held-request banner, and a federation
 * note. See docs/CHAT-ROADMAP.md.
 *
 * Signed-in only, by explicit product decision: the chat is for members, and
 * nothing here is public even in principle, since every row is addressed to
 * exactly two people.
 *
 * CHAT-ROADMAP's Path A -- live delivery over a Durable Object socket -- is
 * blocked on this view existing, because a socket needs somewhere to put what
 * it receives. It is deliberately not in this change. `useConversation` polls
 * on an interval in the meantime, and that interval is the thing the socket
 * removes.
 */

'use client';

import { useSession } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessagesView } from './_components/messages-view';

export default function MessagesPage() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-8">
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

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-pana-ink text-2xl font-extrabold">Messages</h1>
        <p className="text-pana-ink/55 text-sm font-medium">
          Direct messages disappear 30 days after they are sent.
        </p>
      </div>
      <MessagesView />
    </main>
  );
}
