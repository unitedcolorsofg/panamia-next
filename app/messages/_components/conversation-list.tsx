'use client';

import { useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { usePanaSearch, type MessageableActor } from '@/lib/query/social';
import { ChatAvatar, ChatName, type ChatActor } from './chat-primitives';
import {
  conversationSnippet,
  expiresToday,
  lastActiveLabel,
  remoteHost,
} from '../_lib/format';
import {
  filterConversations,
  newConversationCandidates,
  normalizeSearchTerm,
} from '../_lib/search';
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
 *
 * The search box searches two things at once -- the threads below it, and the
 * membership. That is not a flourish: a conversation list can only show people
 * you have already written to, so without the second half this page is a room
 * with no door, and the empty state has to send members somewhere else to
 * begin. See ../_lib/search.ts.
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
  const [query, setQuery] = useState('');
  const term = normalizeSearchTerm(query);

  // Threads filter locally and instantly; people cost a request, so only that
  // half waits for a pause in typing.
  const debouncedTerm = useDebounce(term, 200);

  const visible = filterConversations(entries, term);

  /**
   * Offering new people is an Inbox behaviour only.
   *
   * Requests is a triage folder -- it answers "who wrote to me that I have
   * not accepted", and a row inviting you to start writing to a stranger is
   * not an answer to that question. Passing an empty term also keeps the
   * query disabled there rather than merely hiding what it returned.
   */
  const composing = view === 'inbox' && term.length > 0;
  const panas = usePanaSearch(composing ? debouncedTerm : '');
  const candidates = newConversationCandidates(panas.data ?? [], {
    existing: entries,
    viewerActorId,
  });

  // Computed from the same rows the list renders rather than from a separate
  // count, so the banner cannot advertise a number the list does not show.
  // The expiry is otherwise invisible, which is how you lose a conversation
  // and file it as a bug.
  const expiring = visible.filter((entry) =>
    expiresToday(entry.lastMessage.expiresAt)
  );

  /**
   * Picking anyone clears the box.
   *
   * Leaving the term in place would leave the list filtered to the search
   * that found the thread, so the one conversation you just opened would sit
   * alone above a "start a new conversation" heading offering the person you
   * are now talking to. Worse for a brand-new thread, which matches no filter
   * at all and would therefore vanish from the list at the moment it opened.
   */
  const choose = (actorId: string) => {
    setQuery('');
    onSelect(actorId);
  };

  return (
    <aside className="border-pana-ink/14 flex flex-col border-b-2 lg:border-r-2 lg:border-b-0">
      <div className="border-pana-ink/10 border-b p-3">
        {/* A real input, which it was not before: this shipped as a div
            wrapping a span, carried over from the mock it was promoted from.
            It had the exact silhouette of a search field -- pill, magnifier,
            placeholder-grey label -- and could not be focused or typed into,
            so the only way to discover it was decorative was to try to use
            it. A control that looks interactive and is not is worse than no
            control, because it absorbs the attempt and reports nothing. */}
        <label className="bg-pana-butter-2/70 border-pana-ink/10 focus-within:border-pana-indigo flex items-center gap-2 rounded-full border px-3 py-2 transition-colors">
          <Search
            className="text-pana-ink/40 h-4 w-4 flex-none"
            aria-hidden="true"
          />
          <span className="sr-only">Search messages or find a pana</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search messages or find a pana"
            className="text-pana-ink placeholder:text-pana-ink/45 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
          />
        </label>
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

      {!isLoading && visible.length === 0 && !term && (
        <p className="text-pana-ink/45 px-4 py-8 text-center text-sm font-medium">
          {view === 'requests'
            ? 'No message requests.'
            : 'No conversations yet. Search for a pana above to start one.'}
        </p>
      )}

      {/* Requests is the one folder where a search can come back empty and
          have nothing underneath it to explain itself: the people results
          below are Inbox-only, so without this the panel would simply go
          blank and look like the box had failed again. */}
      {!isLoading && visible.length === 0 && term.length > 0 && !composing && (
        <p className="text-pana-ink/45 px-4 py-8 text-center text-sm font-medium">
          No requests match that.
        </p>
      )}

      <ul>
        {visible.map((entry) => {
          const actor = entry.actor;
          const isActive = actor.id === activeActorId;
          return (
            <li key={actor.id}>
              <button
                type="button"
                onClick={() => choose(actor.id)}
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

      {composing && (
        <div className="border-pana-ink/10 border-t">
          <p className="text-pana-ink/45 px-3 pt-3 pb-1 text-[11px] font-extrabold tracking-wide uppercase">
            Start a new conversation
          </p>

          {panas.isLoading && (
            <p className="text-pana-ink/45 px-4 pt-1 pb-4 text-sm font-bold">
              Searching…
            </p>
          )}

          {!panas.isLoading && candidates.length === 0 && (
            <p className="text-pana-ink/45 px-4 pt-1 pb-4 text-sm font-medium">
              {visible.length > 0
                ? 'No other panas match that.'
                : 'No panas match that.'}
            </p>
          )}

          <ul>
            {candidates.map((pana) => (
              <li key={pana.id}>
                <NewConversationRow
                  pana={pana}
                  localDomain={localDomain}
                  onChoose={choose}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

/**
 * Someone the viewer has never written to.
 *
 * Opens an empty thread rather than a compose dialog, which needs no new
 * endpoint: the conversation route resolves any actor the viewer may see and
 * answers with an empty transcript, and the composer below it already knows
 * how to send the first message. A separate "new message" modal would be a
 * second way to reach the same send path, and only one of them would stay in
 * step with the gate.
 */
function NewConversationRow({
  pana,
  localDomain,
  onChoose,
}: {
  pana: MessageableActor;
  localDomain: string | null;
  onChoose: (actorId: string) => void;
}) {
  const actor: ChatActor = {
    id: pana.id,
    username: pana.username,
    // Every row here is local -- the endpoint only returns actors with a
    // profile on this server -- so there is no federation mark to draw.
    domain: localDomain ?? '',
    name: pana.displayName,
    iconUrl: pana.avatarUrl,
  };

  return (
    <button
      type="button"
      onClick={() => onChoose(pana.id)}
      className="hover:bg-pana-butter-2/50 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
    >
      <ChatAvatar actor={actor} size={36} />
      <span className="min-w-0 flex-1">
        <ChatName actor={actor} remoteHost={null} />
        <span className="text-pana-ink/55 mt-0.5 block truncate text-[13px] font-medium">
          @{pana.username}
        </span>
      </span>
      <UserPlus
        className="text-pana-ink/35 h-4 w-4 flex-none"
        aria-hidden="true"
      />
    </button>
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
