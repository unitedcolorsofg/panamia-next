'use client';

import { Globe } from 'lucide-react';
import Link from 'next/link';
import { SafeHtml } from '@/components/safe-html';
import { AttachmentGrid } from '@/components/social/AttachmentGrid';
import type { SocialActorDisplay, SocialStatusDisplay } from '@/lib/interfaces';
import {
  ChatAvatar,
  ChatName,
  DeliveryMark,
  ExpiryChip,
} from './chat-primitives';
import {
  actorHandle,
  dayLabel,
  expiresInLabel,
  groupMessages,
  remoteHost,
  timeLabel,
} from '../_lib/format';

/* The transcript -- the thing that did not exist in the product before this.
 *
 * /updates is lists and triage: four tabs of statuses with no conversation
 * anywhere. This is the missing half, and CHAT-ROADMAP's Path A is blocked on
 * it, because a socket needs somewhere to put what it receives.
 *
 * Bubbles, viewer on the right, grouped when consecutive, one clock time per
 * group rather than per line, day separators instead of per-message dates.
 * That much is ordinary.
 *
 * What is not ordinary is everything the substrate forces onto the screen:
 * expiry chips, delivery marks, a federation note, and two different ways for
 * the gate to say no. Those are the parts a generic chat UI would have omitted
 * and then discovered in production. */
export function Transcript({
  counterparty,
  messages,
  viewerActorId,
  localDomain,
  isInboundRequest,
  pending,
  onAccept,
  onDelete,
  isTriaging,
}: {
  counterparty: SocialActorDisplay;
  messages: SocialStatusDisplay[];
  viewerActorId: string;
  localDomain: string | null;
  /**
   * Whether this person's messages are sitting in the viewer's own Requests
   * folder. Not the same question as whether the viewer may write to them --
   * that is the composer's, and it is answered separately. This one is about
   * the viewer's own data, which is why it is safe to show at all.
   */
  isInboundRequest: boolean;
  /** Text submitted but not yet confirmed by a refetch. */
  pending: string | null;
  onAccept: () => void;
  onDelete: () => void;
  isTriaging: boolean;
}) {
  const groups = groupMessages(messages);
  const host = remoteHost(counterparty, localDomain);

  return (
    <section className="flex min-h-[34rem] flex-col">
      <header className="border-pana-ink/14 flex items-center gap-3 border-b-2 px-5 py-3">
        <ChatAvatar actor={counterparty} size={38} />
        <div className="min-w-0 flex-1">
          <ChatName actor={counterparty} remoteHost={host} />
          {/* Where a messenger would say "Active now", this says where the
              person is. Presence is a claim we would have to keep true on
              every reconnect; a handle is simply a fact. */}
          <Link
            href={`/p/${counterparty.username}`}
            className="text-pana-ink/55 hover:text-pana-ink block truncate text-xs font-bold"
          >
            @{actorHandle(counterparty, localDomain)}
          </Link>
        </div>
      </header>

      {isInboundRequest && (
        <HeldBanner
          counterparty={counterparty}
          onAccept={onAccept}
          onDelete={onDelete}
          isTriaging={isTriaging}
        />
      )}
      {host && <FederationBanner host={host} />}

      <div className="bg-pana-cream/70 flex-1 space-y-1 px-5 py-5">
        {messages.length === 0 && (
          <p className="text-pana-ink/45 py-10 text-center text-sm font-medium">
            No messages here yet.
          </p>
        )}

        {groups.map((group, groupIndex) => {
          const mine = group[0].actor.id === viewerActorId;
          const prior = groups[groupIndex - 1];
          const day = dayLabel(group[0].published);
          const showDay = !prior || dayLabel(prior[0].published) !== day;
          const last = group[group.length - 1];

          return (
            <div key={group[0].id}>
              {showDay && (
                <div className="py-3 text-center">
                  <span className="bg-pana-ink/8 text-pana-ink/60 rounded-full px-3 py-1 text-[11px] font-extrabold">
                    {day}
                  </span>
                </div>
              )}

              <div
                className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
              >
                {!mine && <ChatAvatar actor={counterparty} size={28} />}
                <div
                  className={`flex max-w-[78%] flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}
                >
                  {group.map((message) => (
                    <Bubble key={message.id} message={message} mine={mine} />
                  ))}

                  <span className="flex items-center gap-2 px-1">
                    <span className="text-pana-ink/45 text-[11px] font-bold">
                      {timeLabel(last.published)}
                    </span>
                    {mine && <DeliveryMark state="sent" />}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* The message you just sent, before the server has confirmed it.
            Rendered as its own bubble marked "Sending" rather than inserted
            into the list with a tick, because a tick beside a row that does
            not exist yet is the one lie this interface refuses to tell. It is
            replaced by the real row on the next refetch. */}
        {pending && (
          <div className="flex items-end justify-end gap-2">
            <div className="flex max-w-[78%] flex-col items-end gap-1">
              <div className="bg-pana-indigo/70 text-pana-cream rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed font-medium whitespace-pre-line">
                {pending}
              </div>
              <span className="px-1">
                <DeliveryMark state="sending" />
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Bubble({
  message,
  mine,
}: {
  message: SocialStatusDisplay;
  mine: boolean;
}) {
  const expiresIn = expiresInLabel(message.expiresAt);
  const hasText = !!message.content?.trim();

  return (
    <div
      className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}
    >
      {hasText && (
        <div
          className={`rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed font-medium ${
            mine
              ? 'bg-pana-indigo text-pana-cream'
              : 'border-pana-ink/14 text-pana-ink border-2 bg-white'
          }`}
        >
          {/* SafeHtml, not dangerouslySetInnerHTML: a DM body can arrive from
              a federated server, which makes it exactly the untrusted HTML
              that component exists for. */}
          <SafeHtml html={message.content} className="chat-bubble-body" />
        </div>
      )}

      {/* Voice memos are the only DM Pana Social could send before this view
          existed, so the transcript has to have an answer for them. Reusing
          the production attachment grid rather than redrawing a player means
          they behave the same here as everywhere else. */}
      {!!message.attachments?.length && (
        <div
          className={`w-72 max-w-full rounded-2xl px-3 py-1 ${
            mine ? 'bg-pana-indigo/10' : 'border-pana-ink/14 border-2 bg-white'
          }`}
        >
          <AttachmentGrid attachments={message.attachments} />
        </div>
      )}

      {expiresIn && <ExpiryChip expiresIn={expiresIn} />}
    </div>
  );
}

/* HELD, not delivered.
 *
 * Shown when this person's messages are in the viewer's own Requests folder.
 * It carries one specific fact -- that nothing notified them -- because that
 * is the property dm-gate.ts is enforcing and it is invisible by construction.
 * Saying it out loud is also the only way to tell this apart from an ordinary
 * thread.
 *
 * Note the direction. This is the viewer's inbox, not a readout of the
 * sender's experience: the sender was never told their message was held, and
 * no banner on their side says so. */
function HeldBanner({
  counterparty,
  onAccept,
  onDelete,
  isTriaging,
}: {
  counterparty: SocialActorDisplay;
  onAccept: () => void;
  onDelete: () => void;
  isTriaging: boolean;
}) {
  const first = (counterparty.name || counterparty.username).split(' ')[0];
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
          onClick={onAccept}
          disabled={isTriaging}
          className="bg-pana-indigo text-pana-cream rounded-full px-3.5 py-1.5 text-xs font-extrabold disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isTriaging}
          className="border-pana-ink/20 text-pana-ink rounded-full border-2 bg-white px-3.5 py-1.5 text-xs font-bold disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/* The reason the substrate is worth keeping, and a limit at the same time.
 *
 * This conversation reaches another server, which no Durable Object room could
 * do. It also cannot be live in the same way: delivery to a remote inbox is a
 * queued signed POST that may land minutes later. */
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
