'use client';

import { useState } from 'react';
import { ArrowUp, Mic, Plus } from 'lucide-react';

/* The composer.
 *
 * One line, because the shape of the input is a promise about the length of
 * the reply, and this design is asking for short ones.
 *
 * It actually sends. That is a deliberate exception to "mocks are static":
 * the thing being proposed is a delivery state machine, and sending → sent is
 * not something a screenshot can argue. Clicking the button is the shortest
 * path to seeing whether the states read correctly, including the awkward one
 * where the socket is down and the message is honestly labelled queued rather
 * than optimistically ticked.
 *
 * The microphone is not decoration either - voice memos are the only DM Pana
 * Social can send in production today, so they are the one composer affordance
 * that is already real. */
export function Composer({
  onSend,
  socketDown,
  heldThread,
}: {
  onSend: (body: string) => void;
  socketDown: boolean;
  /** Replying to a held request is what accepts it, so say so. */
  heldThread: boolean;
}) {
  const [draft, setDraft] = useState('');

  function submit() {
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft('');
  }

  return (
    <footer className="border-pana-ink/14 border-t-2 p-3">
      {heldThread && (
        <p className="text-pana-ink/55 px-1 pb-2 text-[11px] font-bold">
          Replying accepts this request and opens your inbox to them.
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="text-pana-ink/50 hover:bg-pana-butter-2 flex h-9 w-9 flex-none items-center justify-center rounded-full"
          aria-label="Add attachment"
        >
          <Plus className="h-5 w-5" />
        </button>

        <div className="bg-pana-butter-2/70 border-pana-ink/10 flex flex-1 items-center rounded-full border px-4 py-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={socketDown ? 'Message (offline)' : 'Message'}
            aria-label="Message"
            className="text-pana-ink placeholder:text-pana-ink/45 w-full bg-transparent text-sm font-bold outline-none"
          />
        </div>

        <button
          type="button"
          className="text-pana-ink/50 hover:bg-pana-butter-2 flex h-9 w-9 flex-none items-center justify-center rounded-full"
          aria-label="Record voice memo"
        >
          <Mic className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          className="bg-pana-indigo text-pana-cream flex h-9 w-9 flex-none items-center justify-center rounded-full disabled:opacity-35"
          aria-label="Send"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>
    </footer>
  );
}
