'use client';

import { Search } from 'lucide-react';
import { ChatAvatar, ChatName, type ChatActor } from './chat-primitives';
import {
  conversationSnippet,
  expiresToday,
  lastActiveLabel,
  remoteHost,
} from '../_lib/format';
import type { SocialStatusDisplay } from '@/lib/interfaces';

/* The conversation list.
 *
 * One line per thread, because a chat list is for recognising a person rather
 * than triaging content -- you open the thread.
 *
 * Three things differ from an ordinary messenger, and all three come from the
 * substrate rather than from taste.
 *
 * No presence dots. Presence is out of scope, and a list that implies
 * availability is the most expensive thing a messaging UI can imply, because
 * it turns "no reply" into "they saw you and ignored you".
 *
 * No unread counts. Read state is not in the schema -- nothing records that a
 * DM was seen -- so a number here would have to be invented, and an invented
 * one is how a list ends up permanently claiming one unread message that
 * cannot be cleared.
 *
 * Requests is a view, not a badge. dm-gate.ts holds a stranger's message and
 * must not notify, and a badge is a notification with a smaller hitbox; the
 * count renders as plain text, which you see when you look and not before.
 * Keeping requests here rather than linking out to /updates also matters for
 * a duller reason: getDirectConversations excludes held threads, so without
 * this tab a request would have nowhere in the chat view to be read.
 */

export interface ListEntry {
  actor: ChatActor;
  lastMessage: SocialStatusDisplay;
}

export function ConversationList({
  entries,
  view,
  onChangeView,
  viewerActorId,
  localDomain,
  activeActorId,
  requestCount,
  onSelect,
  isLoading,
}: {
  entries: ListEntry[];
  view: 'inbox' | 'requests';
  onChangeView: (view: 'inbox' | 'requests') => void;
  viewerActorId: string | null;
  localDomain: string | null;
  activeActorId: string | null;
  requestCount: number;
  onSelect: (actorId: string) => void;
  isLoading: boolean;
}) {
  // Computed from the same rows the list renders rather than from a separate
  // count, so the banner cannot advertise a number the list does not show.
  // The expiry is otherwise invisible, which is how you lose a conversation
  // and file it as a bug.
  const expiring = entries.filter((entry) =>
    expiresToday(entry.lastMessage.expiresAt)
  );

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

      <div
        className="border-pana-ink/10 flex border-b"
        role="tablist"
        aria-label="Message folders"
      >
        <FolderTab
          label="Messages"
          active={view === 'inbox'}
          onClick={() => onChangeView('inbox')}
        />
        <FolderTab
          label="Requests"
          count={requestCount}
          active={view === 'requests'}
          onClick={() => onChangeView('requests')}
        />
      </div>

      {expiring.length > 0 && (
        <div className="bg-pana-butter border-pana-ink/10 border-b px-3 py-2">
          <p className="text-pana-ink text-[11px] leading-snug font-bold">
            {expiring.length === 1
              ? '1 conversation has messages disappearing today.'
              : `${expiring.length} conversations have messages disappearing today.`}
          </p>
        </div>
      )}

      {isLoading && (
        <p className="text-pana-ink/45 px-3 py-6 text-center text-sm font-bold">
          Loading…
        </p>
      )}

      {!isLoading && entries.length === 0 && (
        <p className="text-pana-ink/45 px-4 py-8 text-center text-sm font-medium">
          {view === 'requests'
            ? 'No message requests.'
            : 'No conversations yet. Send someone a message from their profile to start one.'}
        </p>
      )}

      <ul className="flex-1">
        {entries.map((entry) => {
          const actor = entry.actor;
          const isActive = actor.id === activeActorId;
          return (
            <li key={actor.id}>
              <button
                type="button"
                onClick={() => onSelect(actor.id)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-pana-butter-2' : 'hover:bg-pana-butter-2/50'
                }`}
              >
                <ChatAvatar actor={actor} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <ChatName
                      actor={actor}
                      remoteHost={remoteHost(actor, localDomain)}
                    />
                    <span className="text-pana-ink/45 flex-none text-[11px] font-bold">
                      {lastActiveLabel(entry.lastMessage.published)}
                    </span>
                  </span>
                  <span className="text-pana-ink/60 mt-0.5 block truncate text-[13px] font-medium">
                    {conversationSnippet(entry.lastMessage, viewerActorId)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function FolderTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 px-3 py-2.5 text-[13px] font-extrabold tracking-wide uppercase transition-colors ${
        active
          ? 'border-pana-indigo text-pana-ink border-b-2'
          : 'text-pana-ink/45 hover:text-pana-ink/70'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className="text-pana-ink/40 ml-1.5 text-[11px] font-bold normal-case">
          {count}
        </span>
      )}
    </button>
  );
}
