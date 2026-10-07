'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ADMIN_CHROME } from '@/lib/admin/theme';
import { getHouse, getPod } from '@/lib/connectors/model';
import type { HouseId, PodId } from '@/lib/connectors/model';

/**
 * The queue of people waiting to be let into the Connectors programme.
 *
 * This is the other half of the gate in `app/api/connectors/join/route.ts`.
 * Applying writes a `pending` record; nothing turns it into membership except
 * somebody clicking Accept here.
 *
 * ## Why this is real when the rest of the page is not
 *
 * The dashboard below it still renders fixtures and says so. This panel reads
 * live rows and writes real decisions, which is why it sits above the mock
 * bar rather than under it — a staff member needs to know which of the things
 * on this screen actually does something, and "everything below is a fixture"
 * would be a lie told over a working Accept button.
 *
 * ## Why the row disappears on success
 *
 * Decided applications are not shown. Keeping them with a greyed-out label
 * would turn a queue you work to empty into a list that only grows, and the
 * record of who decided what is on the profile — `decidedBy` and `decidedAt`
 * — rather than in this panel's memory.
 *
 * The row is removed locally *and* `router.refresh()` is called: the local
 * removal is so the button does not sit there looking unclicked while the
 * server round-trips, and the refresh is because the pod and house tallies
 * elsewhere on the page are now wrong.
 */

export interface PendingApplication {
  profileId: string;
  displayName: string;
  email: string;
  pod: PodId;
  houses: HouseId[];
  bring: string;
  appliedAt: string;
}

export function ApplicationQueue({
  applications,
}: {
  applications: PendingApplication[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(applications);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(profileId: string, decision: 'approve' | 'decline') {
    setBusy(profileId);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/connectors/${profileId}/${decision}`,
        { method: 'POST' }
      );
      const data = (await res.json()) as { success: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Could not save that decision.');
        setBusy(null);
        return;
      }

      setRows((current) => current.filter((r) => r.profileId !== profileId));
      setBusy(null);
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-pana-ink/60 text-sm leading-relaxed">
        Nobody is waiting. New applications show up here as they come in.
      </p>
    );
  }

  return (
    <>
      <p className="text-pana-ink/70 mb-4 text-sm leading-relaxed">
        {rows.length === 1
          ? 'One person is waiting to hear back.'
          : `${rows.length} people are waiting to hear back.`}{' '}
        Accepting someone puts them in their pod and opens their HQ. Oldest
        application first.
      </p>

      {error && (
        <p
          role="alert"
          className="border-pana-ink bg-pana-butter text-pana-ink mb-4 rounded-lg border-2 px-4 py-3 text-sm font-bold"
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.profileId}
            className="border-pana-ink/20 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-xl border-2 p-4"
          >
            <div className="min-w-0">
              <p className="text-base leading-tight font-extrabold">
                {row.displayName}
              </p>
              <p className="text-pana-ink/60 mt-0.5 text-sm break-words">
                {row.email}
              </p>
              <p className="mt-2 text-sm">
                <span className="font-bold">{getPod(row.pod).name}</span>
                <span className="text-pana-ink/60">
                  {' · '}
                  {row.houses.map((h) => getHouse(h).name).join(', ')}
                </span>
              </p>
              {row.bring && (
                <p className="text-pana-ink/80 mt-2 max-w-prose text-sm leading-snug">
                  &ldquo;{row.bring}&rdquo;
                </p>
              )}
              <p className="text-pana-ink/50 mt-2 text-xs">
                Applied {formatApplied(row.appliedAt)}
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busy === row.profileId}
                onClick={() => decide(row.profileId, 'approve')}
                className="border-pana-ink bg-pana-ink text-pana-cream rounded-full border-2 px-4 py-2 text-sm font-extrabold disabled:opacity-60"
              >
                {busy === row.profileId ? 'Saving…' : 'Accept'}
              </button>
              <button
                type="button"
                disabled={busy === row.profileId}
                onClick={() => decide(row.profileId, 'decline')}
                className={`rounded-full border-2 px-4 py-2 text-sm font-extrabold ${ADMIN_CHROME.ACCENT} border-pana-ink/40 disabled:opacity-60`}
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * A date a human can act on.
 *
 * Rendered client-side on purpose. The server and the staff member working the
 * queue are rarely in the same timezone, and "applied 3 October" is only
 * useful if it means October the 3rd where the reader is.
 */
function formatApplied(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'at an unknown time';

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
