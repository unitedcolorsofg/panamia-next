'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { RefusedComposer } from './chat-primitives';

/* The composer.
 *
 * One line, Enter to send, and a gate that is answered before the box is drawn
 * rather than after the message is written.
 *
 * Two states, not the gate's three. `refuse` removes the input entirely -- see
 * RefusedComposer. `hold` is reported to this component as `allow`, because
 * telling the sender their message will land in the recipient's Requests
 * folder discloses the recipient's settings, which is precisely what
 * dm-gate.ts is built to withhold. The message is genuinely delivered either
 * way; the composer simply has nothing to say about where.
 *
 * No attachment button yet. Voice memos already reach DMs through the existing
 * recorder, and adding a second upload path here before the transcript is
 * proven would be two half-built things instead of one finished one. */
export function Composer({
  canSend,
  counterpartyName,
  onSend,
  isSending,
  error,
}: {
  canSend: 'allow' | 'refuse';
  counterpartyName: string;
  onSend: (text: string) => void;
  isSending: boolean;
  error: string | null;
}) {
  const [text, setText] = useState('');

  if (canSend === 'refuse') return <RefusedComposer />;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setText('');
    onSend(trimmed);
  };

  return (
    <footer className="border-pana-ink/14 border-t-2 bg-white px-4 py-3">
      {/* The gate also runs server-side inside createStatus, so a refusal can
          arrive here even when the view believed it was allowed -- the
          recipient may have changed a setting while this page was open. It is
          shown in place, above the box the words are still in, rather than as
          a toast that disappears while they are being retyped. */}
      {error && (
        <p className="text-pana-red-deep mb-2 text-[11px] font-bold">{error}</p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Message"
          aria-label={`Message ${counterpartyName}`}
          className="border-pana-ink/16 text-pana-ink placeholder:text-pana-ink/40 focus:border-pana-indigo max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-2xl border-2 px-3.5 py-2 text-[15px] font-medium outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || isSending}
          aria-label="Send"
          className="bg-pana-indigo text-pana-cream flex h-10 w-10 flex-none items-center justify-center rounded-full disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}
