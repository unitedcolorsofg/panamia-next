'use client';

import { useEffect, useState } from 'react';
import { Globe, ShieldAlert, Clock3 } from 'lucide-react';
import {
  groupMessages,
  REFUSAL_COPY,
  type MockChatMessage,
  type MockChatThread,
} from '../_data/mock-dm-chat';
import {
  ChatAvatar,
  ChatName,
  ChatWaveform,
  DeliveryMark,
  ExpiryChip,
} from './chat-primitives';

/* The transcript — the thing that does not exist in the product today.
 *
 * /updates is lists and triage: four tabs of statuses with no conversation
 * anywhere. Everything below is the missing half, and CHAT-ROADMAP's Path A
 * is blocked on it, because a socket needs somewhere to put what it receives.
 *
 * Bubbles, viewer on the right, grouped when consecutive, one clock time per
 * group rather than per line, day separators instead of per-message dates.
 * That much is ordinary and is inherited from the chat model at /mock/dms.
 *
 * What is not ordinary is everything the substrate forces onto the screen:
 * expiry chips, delivery marks, a federation note, and two different ways for
 * the gate to say no. Those are the parts worth reviewing, because they are
 * the parts a generic chat UI would have omitted and then discovered in
 * production. */
export function Transcript({
  thread,
  messages,
  animatedIds,
  socketDown,
}: {
  thread: MockChatThread;
  /**
   * Composed by the parent: the fixture messages, plus anything that arrived
   * over the socket, plus anything sent this session. Kept out here so the
   * transcript stays a renderer and the delivery state machine lives in one
   * place rather than being half-owned by the component that draws it.
   */
  messages: MockChatMessage[];
  /** Messages that should fade in rather than appear. */
  animatedIds: string[];
  socketDown: boolean;
}) {
  const groups = groupMessages(messages);

  return (
    <section className="flex min-h-[34rem] flex-col">
      <header className="border-pana-ink/14 flex items-center gap-3 border-b-2 px-5 py-3">
        <ChatAvatar person={thread.person} size={38} />
        <div className="min-w-0 flex-1">
          <ChatName person={thread.person} />
          {/* Where /mock/dms said "Active now", this says where the person is.
              Presence was a claim we would have had to keep true on every
              reconnect; a handle is simply a fact. */}
          <p className="text-pana-ink/55 truncate text-xs font-bold">
            @{thread.person.handle}
          </p>
        </div>
      </header>

      {thread.gate === 'hold' && <HeldBanner thread={thread} />}
      {thread.person.remoteHost && (
        <FederationBanner host={thread.person.remoteHost} />
      )}
      {socketDown && <ReconnectingBanner />}

      <div className="bg-pana-cream/70 flex-1 space-y-1 px-5 py-5">
        {groups.map((group, groupIndex) => {
          const mine = group[0].from === 'me';
          const prior = groups[groupIndex - 1];
          const showDay = !prior || prior[0].day !== group[0].day;
          const last = group[group.length - 1];

          return (
            <div key={group[0].id}>
              {showDay && (
                <div className="py-3 text-center">
                  <span className="bg-pana-ink/8 text-pana-ink/60 rounded-full px-3 py-1 text-[11px] font-extrabold">
                    {group[0].day}
                  </span>
                </div>
              )}

              <div
                className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
              >
                {!mine && <ChatAvatar person={thread.person} size={28} />}
                <div
                  className={`flex max-w-[78%] flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}
                >
                  {group.map((message) => (
                    <Bubble
                      key={message.id}
                      message={message}
                      mine={mine}
                      isLive={animatedIds.includes(message.id)}
                    />
                  ))}

                  <span className="flex items-center gap-2 px-1">
                    <span className="text-pana-ink/45 text-[11px] font-bold">
                      {last.time}
                    </span>
                    {mine && last.delivery && (
                      <DeliveryMark state={last.delivery} />
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* A single bubble.
 *
 * `isLive` fades the message in on mount rather than snapping it into place.
 * This is the one piece of motion in the mock and it is load-bearing: live
 * delivery is the feature being argued for, and a transcript that updates
 * looks exactly like one that does not until something moves.
 *
 * Gated on `motion-reduce` because the rest of this codebase gates its motion
 * and an arriving message still has to arrive for someone who has asked the
 * machine to stop moving. */
function Bubble({
  message,
  mine,
  isLive,
}: {
  message: MockChatMessage;
  mine: boolean;
  isLive: boolean;
}) {
  const [entered, setEntered] = useState(!isLive);

  useEffect(() => {
    if (!isLive) return;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [isLive]);

  const motion = isLive
    ? `transition-all duration-500 ease-out motion-reduce:transition-none ${
        entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`
    : '';

  return (
    <div
      className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}
    >
      {message.voice ? (
        <div
          className={`w-64 rounded-2xl px-3 py-2.5 ${motion} ${
            mine ? 'bg-pana-indigo' : 'border-pana-ink/14 border-2 bg-white'
          }`}
        >
          <ChatWaveform
            peaks={message.voice.peaks}
            duration={message.voice.duration}
            tone={mine ? 'dark' : 'light'}
          />
        </div>
      ) : (
        <div
          className={`rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed font-medium whitespace-pre-line ${motion} ${
            mine
              ? 'bg-pana-indigo text-pana-cream'
              : 'border-pana-ink/14 text-pana-ink border-2 bg-white'
          }`}
        >
          {message.body}
        </div>
      )}

      {message.expiresIn && <ExpiryChip expiresIn={message.expiresIn} />}
    </div>
  );
}

/* HELD, not delivered.
 *
 * The banner has to carry one specific fact - that nothing notified the
 * reader - because that is the property dm-gate.ts is actually enforcing, and
 * it is invisible by construction. Saying it out loud is also the only way a
 * reviewer can tell this apart from an ordinary unread thread. */
function HeldBanner({ thread }: { thread: MockChatThread }) {
  const first = thread.person.name.split(' ')[0];
  return (
    <div className="bg-pana-butter border-pana-ink/14 border-b-2 px-5 py-3">
      <p className="text-pana-ink text-sm font-medium">
        <span className="font-extrabold">
          {first} is not one of your Panas.
        </span>{' '}
        This is waiting in Requests and did not notify you. Replying lets them
        message you from now on.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="bg-pana-indigo text-pana-cream rounded-full px-3.5 py-1.5 text-xs font-extrabold"
        >
          Accept
        </button>
        <button
          type="button"
          className="border-pana-ink/20 text-pana-ink rounded-full border-2 bg-white px-3.5 py-1.5 text-xs font-bold"
        >
          Delete
        </button>
        <button
          type="button"
          className="border-pana-ink/20 text-pana-ink rounded-full border-2 bg-white px-3.5 py-1.5 text-xs font-bold"
        >
          Block
        </button>
      </div>
    </div>
  );
}

/* The reason the substrate is worth keeping, and a limit at the same time.
 *
 * This conversation reaches a Mastodon server, which no Durable Object room
 * could do. It also cannot be live in the same way: delivery to a remote
 * inbox is a queued signed POST that may land minutes later, so the socket
 * accelerates our half of the exchange and nothing at all of theirs. */
function FederationBanner({ host }: { host: string }) {
  return (
    <div className="bg-pana-indigo/8 border-pana-ink/10 flex items-start gap-2 border-b px-5 py-2.5">
      <Globe
        className="text-pana-indigo/70 mt-px h-3.5 w-3.5 flex-none"
        aria-hidden="true"
      />
      <p className="text-pana-ink/70 text-xs leading-snug font-medium">
        <span className="font-extrabold">On {host}.</span> Messages are
        delivered to their server, so replies arrive when it accepts them rather
        than instantly.
      </p>
    </div>
  );
}

/* The socket is best-effort and Postgres is the truth, so the honest thing to
   show when the connection drops is that sending still works and only the
   speed is gone. A UI that greys out the composer here would be inventing an
   outage the server does not have. */
function ReconnectingBanner() {
  return (
    <div className="bg-pana-butter-2 border-pana-ink/10 flex items-center gap-2 border-b px-5 py-2">
      <Clock3
        className="text-pana-ink/50 h-3.5 w-3.5 flex-none animate-pulse"
        aria-hidden="true"
      />
      <p className="text-pana-ink/70 text-xs font-bold">
        Reconnecting — messages still send, they just won’t appear instantly.
      </p>
    </div>
  );
}

/* REFUSED.
 *
 * Replaces the composer rather than erroring after a send, so nobody writes a
 * paragraph into a box that was never going to accept it.
 *
 * The copy is the single string dm-gate.ts returns for every refusal, and the
 * vagueness is the feature: a block and a closed inbox must be indistinguish-
 * able, or a blocked sender can detect the block by sending one message and
 * reading the wording. Friendlier per-case copy is the obvious design
 * improvement here and it is the one that breaks the safety property. */
export function RefusedComposer() {
  return (
    <footer className="border-pana-ink/14 bg-pana-ink/4 border-t-2 px-5 py-4">
      <p className="text-pana-ink/70 flex items-center justify-center gap-2 text-center text-sm font-bold">
        <ShieldAlert className="h-4 w-4 flex-none" aria-hidden="true" />
        {REFUSAL_COPY}
      </p>
    </footer>
  );
}
