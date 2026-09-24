'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Lock, Send, Wifi } from 'lucide-react';
import type { MockChatMessage, ViewerState } from '../_data/mock-group';

/* The realtime room — phase 5 of docs/GROUPS-ROADMAP.md, and the surface that
 * answers "don't make panas leave the site".
 *
 * Mocked deliberately next to the posts tab so the two can be compared. The
 * roadmap argues in prose that chat and posts are different products; putting
 * them one tab apart is what makes that argument visible. Nothing in this
 * panel wants a like button, a boost, or a permalink, and nothing in the posts
 * tab wants a presence indicator.
 *
 * Three details here are load-bearing design decisions rather than mock
 * dressing:
 *
 *   1. The presence line names a real number. A room that says "live" without
 *      saying who is in it is the kind of thing panas learn to distrust.
 *   2. Non-members get the locked state, never a read-only transcript. In the
 *      proposed design the WebSocket upgrade is refused at the Worker before
 *      the Durable Object is ever reached, so there is no transcript to leak.
 *   3. The composer is disabled rather than hidden for a visitor, because the
 *      point being made is "you could talk here if you joined", and a missing
 *      composer says nothing at all. */
export function GroupChat({
  messages,
  viewer,
  joined,
}: {
  messages: MockChatMessage[];
  viewer: ViewerState;
  joined: boolean;
}) {
  const [draft, setDraft] = useState('');
  const canTalk = viewer === 'member' || joined;

  if (viewer === 'locked') {
    return (
      <div className="reserved-slot items-start p-6">
        <p className="reserved-slot-title inline-flex items-center gap-2">
          <Lock className="h-4 w-4" aria-hidden="true" />
          The room is closed to non-members
        </p>
        <p className="text-pana-ink/65 text-[13px] leading-snug font-medium">
          Nothing from this conversation is loaded on this page. The connection
          is refused before it opens, so there is no transcript here to reveal.
        </p>
      </div>
    );
  }

  return (
    <div className="profile-card overflow-hidden">
      <div className="border-pana-ink/10 flex items-center gap-2 border-b px-4 py-3">
        <span className="text-pana-ink/70 inline-flex items-center gap-1.5 text-[13px] font-extrabold">
          <Wifi className="text-pana-indigo h-3.5 w-3.5" aria-hidden="true" />
          Live
        </span>
        <span aria-hidden="true" className="text-pana-ink/25">
          ·
        </span>
        <span className="text-pana-ink/55 text-[13px] font-bold">
          9 members in the room
        </span>
      </div>

      <div className="max-h-[26rem] space-y-4 overflow-y-auto p-4">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
      </div>

      <div className="border-pana-ink/10 border-t p-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setDraft('');
          }}
        >
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!canTalk}
            placeholder={
              canTalk ? 'Message the group…' : 'Join the group to say something'
            }
            aria-label="Message the group"
            className="border-pana-ink/15 focus:border-pana-indigo min-w-0 flex-1 rounded-full border bg-white px-4 py-2 text-[14px] font-medium outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canTalk || draft.trim().length === 0}
            className="bg-pana-indigo text-pana-cream inline-flex h-10 w-10 flex-none items-center justify-center rounded-full disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        {/* Says out loud what the roadmap says in prose: this history is a
            Postgres table, not a relay and not a Durable Object that empties
            when the last person leaves. Panas should know a moderator can
            actually remove something here. */}
        <p className="text-pana-ink/45 mt-2 px-1 text-[12px] font-bold">
          Messages stay in the group and can be removed by an admin.
        </p>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: MockChatMessage }) {
  if (message.mine) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          <p className="bg-pana-indigo text-pana-cream rounded-2xl rounded-br-sm px-3.5 py-2 text-[14px] leading-snug font-medium">
            {message.body}
          </p>
          <p className="text-pana-ink/40 mt-1 pr-1 text-right text-[11px] font-bold">
            {message.sent}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <span className="border-pana-ink/10 relative h-8 w-8 flex-none overflow-hidden rounded-full border">
        <Image
          src={message.avatar}
          alt=""
          fill
          sizes="32px"
          className="object-cover"
        />
      </span>
      <div className="max-w-[80%] min-w-0">
        <p className="text-pana-ink/55 mb-0.5 text-[12px] font-extrabold">
          {message.author}
        </p>
        <p className="bg-pana-ink/[0.06] rounded-2xl rounded-tl-sm px-3.5 py-2 text-[14px] leading-snug font-medium">
          {message.body}
        </p>
        <p className="text-pana-ink/40 mt-1 pl-1 text-[11px] font-bold">
          {message.sent}
        </p>
      </div>
    </div>
  );
}
