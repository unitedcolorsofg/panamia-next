'use client';

import { ShieldQuestion, Search, ArrowLeft } from 'lucide-react';
import {
  threadSnippet,
  expiringSoon,
  type MockChatThread,
} from '../_data/mock-dm-chat';
import { ChatAvatar, ChatName, UnreadBadge } from './chat-primitives';

/* The conversation list.
 *
 * One line per thread, because a chat list is for recognising a person rather
 * than triaging content - you open the thread. That is the one thing this
 * inherits unchanged from the chat model at /mock/dms.
 *
 * Two things are different, and both come from the substrate rather than from
 * taste.
 *
 * No presence dots. /mock/dms put a green dot on J. Downs. Presence is out of
 * scope, and a list that implies availability is the single most expensive
 * thing a messaging UI can imply, because it converts "no reply" into "they
 * saw you and ignored you".
 *
 * Requests carries no unread badge. dm-gate.ts holds a stranger's message and
 * must not notify - and a badge is a notification with a smaller hitbox. The
 * count renders as plain text, which you see when you look and not before.
 * This distinction is the entire point of holding the message, so it is worth
 * the restraint. */
export function ConversationList({
  threads,
  requests,
  activeId,
  showRequests,
  onSelect,
  onToggleRequests,
}: {
  threads: MockChatThread[];
  requests: MockChatThread[];
  activeId: string;
  showRequests: boolean;
  onSelect: (id: string) => void;
  onToggleRequests: () => void;
}) {
  const visible = showRequests ? requests : threads;
  const expiring = expiringSoon(threads);

  return (
    <aside className="border-pana-ink/14 flex flex-col border-b-2 lg:border-r-2 lg:border-b-0">
      <div className="border-pana-ink/10 border-b p-3">
        <div className="bg-pana-butter-2/70 border-pana-ink/10 flex items-center gap-2 rounded-full border px-3 py-2">
          <Search
            className="text-pana-ink/40 h-4 w-4 flex-none"
            aria-hidden="true"
          />
          <span className="text-pana-ink/45 text-sm font-bold">
            Search messages
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleRequests}
        className="border-pana-ink/10 text-pana-ink/70 hover:bg-pana-butter-2/60 flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-[13px] font-extrabold tracking-wide uppercase"
      >
        {showRequests ? (
          <>
            <ArrowLeft
              className="text-pana-ink/40 h-4 w-4"
              aria-hidden="true"
            />
            Back to messages
          </>
        ) : (
          <>
            <ShieldQuestion
              className="text-pana-ink/40 h-4 w-4"
              aria-hidden="true"
            />
            Requests
            {/* Plain text, not a badge. See the note above. */}
            <span className="text-pana-ink/40 ml-auto text-[11px] font-bold normal-case">
              {requests.length}
            </span>
          </>
        )}
      </button>

      {/* Computed from the same fixtures the transcript renders, per the
          README rule that a mock may not advertise a number it does not show.
          This banner exists because the expiry is currently invisible in the
          product, which is how you lose a conversation and file it as a bug. */}
      {!showRequests && expiring.length > 0 && (
        <div className="bg-pana-butter border-pana-ink/10 border-b px-3 py-2">
          <p className="text-pana-ink text-[11px] leading-snug font-bold">
            {expiring.length === 1
              ? '1 conversation has messages disappearing today.'
              : `${expiring.length} conversations have messages disappearing today.`}
          </p>
        </div>
      )}

      <ul className="flex-1">
        {visible.map((thread) => {
          const isActive = thread.id === activeId;
          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => onSelect(thread.id)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-pana-butter-2' : 'hover:bg-pana-butter-2/50'
                }`}
              >
                <ChatAvatar person={thread.person} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <ChatName person={thread.person} />
                    <span className="text-pana-ink/45 flex-none text-[11px] font-bold">
                      {thread.lastActive}
                    </span>
                  </span>
                  <span className="text-pana-ink/60 mt-0.5 block truncate text-[13px] font-medium">
                    {threadSnippet(thread)}
                  </span>
                </span>
                <UnreadBadge count={thread.unreadCount} />
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
