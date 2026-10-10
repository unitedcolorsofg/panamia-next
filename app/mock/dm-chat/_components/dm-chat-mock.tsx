'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Lock, Sparkles } from 'lucide-react';
import type { MockSurface } from '../../_data/panaverse';
import { SurfaceMasthead } from '../../_components/surface-masthead';
import { ConversationList } from './conversation-list';
import { Transcript, RefusedComposer } from './transcript';
import { Composer } from './composer';
import {
  MOCK_CHAT_THREADS,
  MOCK_CHAT_REQUESTS,
  INCOMING_LIVE_MESSAGE,
  type MockChatMessage,
} from '../_data/mock-dm-chat';

/* The DM chat view, as decided.
 *
 * /mock/dms asked mail or chat and the answer was chat on the direct-status
 * substrate, recorded in docs/CHAT-ROADMAP.md. This route draws the thing
 * that answer implies, and it exists now rather than later because Path A in
 * that roadmap is blocked on it: live delivery has nothing to deliver into
 * until a conversation view exists. /updates is four tabs of lists.
 *
 * The toolbar has one switch and it is not a design variant. It drops the
 * socket, because the interesting question about a realtime UI is not how it
 * looks connected - everything looks fine connected - but whether it tells
 * the truth when it is not. Dropping the socket here is the review. */
export function DmChatMock({ surfaces }: { surfaces: MockSurface[] }) {
  const router = useRouter();
  const current =
    surfaces.find((surface) => surface.id === 'social') ?? surfaces[0];

  const [activeId, setActiveId] = useState(MOCK_CHAT_THREADS[0].id);
  const [showRequests, setShowRequests] = useState(false);
  const [socketDown, setSocketDown] = useState(false);
  const [liveArrived, setLiveArrived] = useState(false);
  const [sentByThread, setSentByThread] = useState<
    Record<string, MockChatMessage[]>
  >({});

  const pool = showRequests ? MOCK_CHAT_REQUESTS : MOCK_CHAT_THREADS;
  const active = pool.find((thread) => thread.id === activeId) ?? pool[0];

  /* One inbound message, a few seconds in. The whole proposal is that a reply
     lands without a refresh, and that claim cannot be reviewed from a static
     render - a transcript that updates looks identical to one that does not
     until something moves. It does not fire while the socket is down, which
     is the point of having a socket at all. */
  useEffect(() => {
    if (liveArrived || socketDown) return;
    const timer = setTimeout(() => setLiveArrived(true), 3500);
    return () => clearTimeout(timer);
  }, [liveArrived, socketDown]);

  const settle = useCallback((threadId: string, messageId: string) => {
    setSentByThread((prev) => ({
      ...prev,
      [threadId]: (prev[threadId] ?? []).map((message) =>
        message.id === messageId ? { ...message, delivery: 'sent' } : message
      ),
    }));
  }, []);

  /* Send is real so the delivery states can be read rather than described.
     With the socket down the message is labelled queued and stays that way -
     it is NOT optimistically ticked, because a tick that appears before the
     row exists is the one lie this UI must not tell. */
  const handleSend = useCallback(
    (body: string) => {
      const threadId = active.id;
      const messageId = `sent-${Date.now()}`;
      const message: MockChatMessage = {
        id: messageId,
        from: 'me',
        body,
        day: 'Today',
        time: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
        delivery: socketDown ? 'queued' : 'sending',
      };

      setSentByThread((prev) => ({
        ...prev,
        [threadId]: [...(prev[threadId] ?? []), message],
      }));

      if (!socketDown) {
        setTimeout(() => settle(threadId, messageId), 900);
      }
    },
    [active.id, socketDown, settle]
  );

  /* Reconnecting flushes what was queued. The recovery path is the half of a
     realtime feature that never gets designed, and it is the half a pana in a
     parking garage actually experiences. */
  useEffect(() => {
    if (socketDown) return;
    setSentByThread((prev) => {
      let changed = false;
      const next: Record<string, MockChatMessage[]> = {};
      for (const [threadId, messages] of Object.entries(prev)) {
        next[threadId] = messages.map((message) => {
          if (message.delivery !== 'queued') return message;
          changed = true;
          return { ...message, delivery: 'sent' as const };
        });
      }
      return changed ? next : prev;
    });
  }, [socketDown]);

  const { messages, animatedIds } = useMemo(() => {
    const live =
      liveArrived && active.id === 'jdowns' ? [INCOMING_LIVE_MESSAGE] : [];
    const sent = sentByThread[active.id] ?? [];
    return {
      messages: [...active.messages, ...live, ...sent],
      animatedIds: [
        ...live.map((message) => message.id),
        ...sent.map((message) => message.id),
      ],
    };
  }, [active, liveArrived, sentByThread]);

  return (
    <main className="surface-cream min-h-screen pb-20">
      <div className="mock-toolbar">
        <span className="mock-toolbar-badge">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Mock
        </span>

        <span className="mock-toolbar-host">
          <Lock className="h-3 w-3 flex-none" aria-hidden="true" />
          {current.hostname}
        </span>

        <div className="mock-switch ml-auto">
          <button
            type="button"
            data-active={!socketDown}
            onClick={() => setSocketDown(false)}
          >
            Socket up
          </button>
          <button
            type="button"
            data-active={socketDown}
            onClick={() => setSocketDown(true)}
          >
            Socket down
          </button>
        </div>

        <Link href="/mock/dms" className="mock-toolbar-link">
          Mail vs chat
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <SurfaceMasthead
        surfaces={surfaces}
        current={current}
        onSelect={(id) => {
          if (id !== current.id) router.push('/mock/panaverse');
        }}
        sticky
        contained
      />

      <div className="container mx-auto max-w-6xl px-4 pt-8">
        <header className="mb-6">
          <h1 className="text-pana-ink text-3xl font-black tracking-tight">
            Messages
          </h1>
          <p className="text-pana-ink/65 mt-1 max-w-3xl text-sm leading-snug font-medium">
            The conversation view Pana Social does not have yet. Chat shape,
            live delivery, running on the direct statuses we already store — so
            it still federates, still carries voice memos, and still answers to
            the DM gate.
          </p>
        </header>

        <div className="profile-card overflow-hidden">
          <div className="grid lg:grid-cols-[19rem_minmax(0,1fr)]">
            <ConversationList
              threads={MOCK_CHAT_THREADS}
              requests={MOCK_CHAT_REQUESTS}
              activeId={active.id}
              showRequests={showRequests}
              onSelect={setActiveId}
              onToggleRequests={() => {
                const next = !showRequests;
                setShowRequests(next);
                setActiveId(
                  next ? MOCK_CHAT_REQUESTS[0].id : MOCK_CHAT_THREADS[0].id
                );
              }}
            />

            <div className="flex min-w-0 flex-col">
              <Transcript
                thread={active}
                messages={messages}
                animatedIds={animatedIds}
                socketDown={socketDown}
              />
              {active.gate === 'refuse' ? (
                <RefusedComposer />
              ) : (
                <Composer
                  onSend={handleSend}
                  socketDown={socketDown}
                  heldThread={active.gate === 'hold'}
                />
              )}
            </div>
          </div>
        </div>

        <DesignNotes />

        <p className="text-pana-ink/45 mt-8 text-center text-xs font-bold">
          /mock/dm-chat — design fixture, not a real inbox.
        </p>
      </div>
    </main>
  );
}

/* What this design commits to and what it still owes, written next to the
   thing rather than in a doc nobody opens during a review.
 *
   The second column is the important one. /mock/dms could end with a tidy
   comparison because it was choosing; this route has already chosen, so the
   only honest thing left to render is the bill. */
function DesignNotes() {
  return (
    <section className="mt-10 grid gap-4 md:grid-cols-2">
      <NoteCard
        title="What it commits to"
        tone="keep"
        items={[
          'Live delivery — a reply lands without a refresh. One socket, one message type.',
          'The substrate stays. Direct statuses, recipientTo, inReplyToId: nothing new to store for DMs.',
          'It still federates. The Mastodon thread works because this is how Mastodon DMs already work.',
          'Voice memos keep working, since they already send as direct statuses.',
          'dm-gate keeps deciding. allow, hold and refuse are all rendered, including the identical refusal string.',
          'Block filtering, moderation and the request flow are inherited rather than rebuilt.',
        ]}
      />
      <NoteCard
        title="What it still owes"
        tone="owe"
        items={[
          'The 7-day expiry. Every DM is hidden after a week today. A transcript that loses its own first page reads as data loss, so this needs a product answer before launch, not after.',
          'No presence, no typing, no read receipts. Deliberate — they are the expensive half of realtime — but it is a gap people will name.',
          'Reconnect behaviour has to be real. Queued-offline is drawn here; it still has to be built.',
          'Remote threads cannot be live inbound. A federated reply arrives when their server sends it.',
          'Group and event rooms are a separate store (chat_rooms, chat_messages) behind the same UI.',
          'Retiring /updates means moving @-mentions and Pana Updates somewhere, since only two of its four tabs are DMs.',
        ]}
      />
    </section>
  );
}

function NoteCard({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'keep' | 'owe';
  items: string[];
}) {
  const keep = tone === 'keep';
  return (
    <div
      className={`rounded-[1.125rem] border-2 bg-white p-5 ${
        keep ? 'border-pana-indigo/35' : 'border-pana-ink/14'
      }`}
    >
      <h2 className="text-pana-ink text-[13px] font-extrabold tracking-[0.1em] uppercase">
        {title}
      </h2>
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="text-pana-ink/80 flex gap-2 text-[13px] leading-snug font-medium"
          >
            <span
              aria-hidden="true"
              className={`flex-none font-black ${
                keep ? 'text-pana-indigo' : 'text-pana-red'
              }`}
            >
              {keep ? '+' : '−'}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
