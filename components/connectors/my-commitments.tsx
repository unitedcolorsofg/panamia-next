'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { HOUSES, getHouse } from '@/lib/connectors/model';
import type { CommitmentProgress, HouseId } from '@/lib/connectors/model';
import type { ConnectorCommitment } from '@/lib/connectors/membership';
import { CONNECTORS_CHROME } from '@/lib/connectors/theme';

/**
 * A connector's own commitments, and the form for adding one.
 *
 * ## Why this is not `CommitmentsTable`
 *
 * `components/connectors/dashboard-parts.tsx` has a commitments table already,
 * and it stays where it is. That one renders the fixture `Commitment` shape —
 * `connectorId`, a list of houses, a tier — and resolves names through
 * `connectorById`, the fixture roster. The admin console still runs on those
 * fixtures and is out of scope here.
 *
 * Reshaping it to serve both would mean a component that takes two row types
 * and a flag, for the sake of a table of five columns. This renders the real
 * stored shape instead and leaves the admin console untouched.
 *
 * ## Why the progress control is a `<select>`
 *
 * Progress is one of three values and changing it is the most common thing
 * done on this page, so it wants to be one interaction rather than two. A
 * select is also the control that announces its current value to a screen
 * reader without needing a label repeated per row.
 *
 * Each change round-trips immediately. There is no save button because there
 * is nothing to batch: one field, one row, one write.
 */

const PROGRESS_LABEL: Record<CommitmentProgress, string> = {
  notSet: 'Not set',
  inProgress: 'In progress',
  done: 'Done',
};

const PROGRESS_ORDER: readonly CommitmentProgress[] = [
  'notSet',
  'inProgress',
  'done',
];

export function MyCommitments({
  commitments,
  houses,
}: {
  commitments: readonly ConnectorCommitment[];
  /** The member's own houses, offered first in the add form. */
  houses: readonly HouseId[];
}) {
  const router = useRouter();
  const [what, setWhat] = useState('');
  const [when, setWhen] = useState('');
  const [house, setHouse] = useState<HouseId>(houses[0] ?? HOUSES[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(
    method: 'POST' | 'PATCH',
    body: Record<string, unknown>
  ): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/connectors/commitments', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Could not save that. Try again.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Could not reach the server. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!what.trim()) {
      setError('Say what you will do.');
      return;
    }
    const ok = await send('POST', { what, when, house });
    if (ok) {
      setWhat('');
      setWhen('');
    }
  }

  return (
    <>
      {commitments.length === 0 ? (
        <p className="text-pana-ink/70 text-sm">
          Nothing on the board yet. Say what you will do below — small is fine,
          that is the whole point of the first tier.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr
                className={`${CONNECTORS_CHROME.FILL} ${CONNECTORS_CHROME.ON_FILL}`}
              >
                <Th>What</Th>
                <Th>When</Th>
                <Th>House</Th>
                <Th>Progress</Th>
                <Th>
                  <span className="sr-only">Remove</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {commitments.map((row) => {
                const rowHouse = getHouse(row.house);
                return (
                  <tr
                    key={row.id}
                    className="border-pana-ink/15 border-b-2 align-top last:border-b-0"
                  >
                    <Td>{row.what}</Td>
                    <Td className="text-pana-ink/70 whitespace-nowrap">
                      {row.when ?? '—'}
                    </Td>
                    <Td>
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap"
                        style={{
                          backgroundColor: `var(--color-${rowHouse.color})`,
                          color: `var(--color-${rowHouse.onColor})`,
                        }}
                      >
                        {rowHouse.name}
                      </span>
                    </Td>
                    <Td>
                      <label>
                        <span className="sr-only">
                          Progress on {row.what}
                        </span>
                        <select
                          value={row.progress}
                          disabled={busy}
                          onChange={(e) =>
                            send('PATCH', {
                              id: row.id,
                              progress: e.target.value,
                            })
                          }
                          className="border-pana-ink bg-pana-cream text-pana-ink rounded-full border-2 px-2.5 py-0.5 text-xs font-bold"
                        >
                          {PROGRESS_ORDER.map((p) => (
                            <option key={p} value={p}>
                              {PROGRESS_LABEL[p]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => send('PATCH', { id: row.id, remove: true })}
                        className="text-pana-ink/60 hover:text-pana-ink text-xs font-bold underline underline-offset-4"
                      >
                        Remove
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-pana-ink/25 mt-6 border-t-2 border-dashed pt-5">
        <h3 className="text-sm font-extrabold tracking-wide uppercase">
          Say you will do something
        </h3>
        {/* No "who" field, unlike the admin console's version of this form. A
          * connector commits themselves; volunteering somebody else is the pod
          * lead's job and it happens in conversation, not in a form. */}
        <form className="mt-3" onSubmit={handleAdd}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="What">
              <input
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                maxLength={500}
                placeholder="Table at the Little Haiti free market"
                className="border-pana-ink bg-pana-cream text-pana-ink placeholder:text-pana-ink/40 w-full rounded-lg border-2 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="When">
              <input
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                maxLength={120}
                placeholder="Early November"
                className="border-pana-ink bg-pana-cream text-pana-ink placeholder:text-pana-ink/40 w-full rounded-lg border-2 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="House">
              <select
                value={house}
                onChange={(e) => setHouse(e.target.value as HouseId)}
                className="border-pana-ink bg-pana-cream text-pana-ink w-full rounded-lg border-2 px-3 py-2 text-sm"
              >
                {/* Their own houses first, then the rest: a commitment usually
                  * sits in a house you are in, but the programme does not stop
                  * you helping another one out. */}
                {[...HOUSES]
                  .sort(
                    (a, b) =>
                      Number(houses.includes(b.id)) -
                      Number(houses.includes(a.id))
                  )
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                      {houses.includes(h.id) ? '' : ' (not your house)'}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          {error && (
            <p
              role="alert"
              className="border-pana-ink bg-pana-butter text-pana-ink mt-3 rounded-lg border-2 px-3 py-2 text-sm font-bold"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`mt-3 rounded-full border-2 ${CONNECTORS_CHROME.BORDER} ${CONNECTORS_CHROME.FILL} px-4 py-2 text-sm font-extrabold ${CONNECTORS_CHROME.ON_FILL} disabled:opacity-60`}
          >
            {busy ? 'Saving…' : 'Add to my commitments'}
          </button>
        </form>
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-extrabold tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-3 py-2 text-xs font-extrabold uppercase">
      {children}
    </th>
  );
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}
