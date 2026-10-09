'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ADMIN_CHROME } from '@/lib/admin/theme';
import { REASON_MIN } from '@/lib/admin/user-locks';

/**
 * The accounts table, with the lock control.
 *
 * ## The warning comes before the button, not after
 *
 * Locking an account does nothing to the listings that account administers.
 * That is deliberate — a directory listing is usually a business other people
 * depend on finding, and pulling it down is a second, larger action with its
 * own queue and its own appeal. Locking one owner should not quietly delist a
 * restaurant.
 *
 * But "nothing happens to the listings" is only defensible if the admin knows
 * that at the moment they decide. So the listing count is rendered in the row
 * and repeated in the confirmation, before the button is pressed, rather than
 * surfacing as a toast afterwards telling somebody what they have already
 * done. An admin locking a four-listing account should have to see the four.
 *
 * ## Why a reason field and not a confirm dialog
 *
 * A yes/no confirm records nothing. Three months later the only thing anyone
 * can recover is that the account is locked, not what it did, and the only
 * person who can answer an appeal is whoever happened to click the button, if
 * they remember. The reason is mandatory in the database too (0058 has a CHECK
 * on it), so this field is not a formality the API can be talked out of.
 */

export interface AccountRow {
  id: string;
  email: string;
  name: string | null;
  screenname: string | null;
  accountType: string;
  emailVerified: boolean;
  createdAt: string;
  lockedAt: string | null;
  administers: number;
  hasProfile: boolean;
  isSuperAdmin: boolean;
  grantedAdmin: boolean;
  isAdmin: boolean;
  isContentModerator: boolean;
  /** Why they were locked, from the audit trail. Null when not locked. */
  lockReason: string | null;
  lockedBy: string | null;
}

function joined(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function Tag({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-pana-ink/15 px-2 py-0.5 text-[11px] font-bold ${tone}`}
    >
      {label}
    </span>
  );
}

export function UsersTable({ rows }: { rows: AccountRow[] }) {
  const router = useRouter();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function begin(id: string) {
    setOpenFor(id);
    setReason('');
    setError(null);
    setNote(null);
  }

  async function submit(row: AccountRow) {
    const action = row.lockedAt ? 'unlock' : 'lock';
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/users/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: row.id, action, reason }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        sessionsRevoked?: number;
      };
      if (!response.ok) {
        setError(payload.error ?? 'That did not go through.');
        return;
      }
      /* Say how many sessions were ended, because that is the part an admin
       * cannot see and would otherwise have to take on trust. Zero is worth
       * reporting too — it means they were not signed in anywhere, not that
       * the revocation failed. */
      setNote(
        action === 'lock'
          ? `Locked. ${payload.sessionsRevoked ?? 0} active session${
              payload.sessionsRevoked === 1 ? '' : 's'
            } ended.`
          : 'Unlocked. They can sign in again.'
      );
      setOpenFor(null);
      setReason('');
      router.refresh();
    } catch {
      setError('Network error. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-pana-ink/60">
        No accounts match that.
      </p>
    );
  }

  return (
    <div>
      {note ? (
        <p className="border-b-2 border-pana-ink/10 bg-pana-butter-2 px-5 py-2 text-sm font-bold text-pana-ink">
          {note}
        </p>
      ) : null}
      <ul className={`divide-y-2 ${ADMIN_CHROME.DIVIDE}`}>
        {rows.map((row) => {
          const label = row.name || row.screenname || row.email;
          const locked = row.lockedAt !== null;
          const open = openFor === row.id;
          /* Admin accounts have no lock button at all rather than a disabled
           * one that explains itself on click. The rule is not a limit on this
           * admin's authority, it is a property of the target — showing it as
           * something they *could* press if they had more rights would be a
           * lie about where the line is. */
          const lockable = !row.isAdmin;

          return (
            <li key={row.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-pana-ink">{label}</span>
                    {row.isSuperAdmin ? (
                      <Tag label="Founder" tone="bg-pana-indigo text-pana-cream" />
                    ) : null}
                    {row.grantedAdmin ? (
                      <Tag label="Admin" tone="bg-pana-blue text-pana-ink" />
                    ) : null}
                    {row.isContentModerator ? (
                      <Tag label="Moderator" tone="bg-pana-butter text-pana-ink" />
                    ) : null}
                    {locked ? (
                      <Tag label="Locked" tone="bg-pana-red text-pana-cream" />
                    ) : null}
                    {!row.emailVerified ? (
                      <Tag label="Unverified" tone="bg-pana-flame text-pana-ink" />
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-pana-ink/70">
                    {row.email}
                  </p>
                  <p className="mt-0.5 text-xs text-pana-ink/60">
                    {row.accountType} · joined {joined(row.createdAt)}
                    {row.screenname ? ` · @${row.screenname}` : ''}
                  </p>
                  {/* The reason, where it is asked for: next to the state it
                      explains, not behind a click into a separate log. */}
                  {locked && row.lockReason ? (
                    <p className="mt-1 text-xs text-pana-ink/80">
                      <span className="font-bold">Locked</span>
                      {row.lockedAt ? ` ${joined(row.lockedAt)}` : ''}
                      {row.lockedBy ? ` by ${row.lockedBy}` : ''} — “
                      {row.lockReason}”
                    </p>
                  ) : null}
                  {locked && !row.lockReason ? (
                    /* Imported from the old MongoDB migration, which set the
                       column directly and left no record behind it. */
                    <p className="mt-1 text-xs text-pana-ink/60">
                      Locked before this log existed — no reason on file.
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {/* Read before the button is pressed, not after. */}
                  {row.administers > 0 ? (
                    <span className="text-xs font-bold text-pana-ink/70">
                      runs {row.administers} listing
                      {row.administers === 1 ? '' : 's'}
                    </span>
                  ) : null}
                  {row.hasProfile ? (
                    <a
                      className="text-xs font-bold text-pana-indigo underline"
                      href={`/admin/users/roles?q=${encodeURIComponent(row.email)}`}
                    >
                      Roles
                    </a>
                  ) : null}
                  {lockable ? (
                    <button
                      type="button"
                      onClick={() => (open ? setOpenFor(null) : begin(row.id))}
                      className={`rounded-full border-2 border-pana-ink px-3 py-1 text-xs font-extrabold ${
                        locked
                          ? 'bg-white text-pana-ink'
                          : 'bg-pana-red text-pana-cream'
                      }`}
                    >
                      {open ? 'Cancel' : locked ? 'Unlock' : 'Lock'}
                    </button>
                  ) : (
                    <span className="text-xs text-pana-ink/50">
                      Holds admin — demote first
                    </span>
                  )}
                </div>
              </div>

              {open ? (
                <div className="mt-3 rounded-lg border-2 border-pana-ink/20 bg-pana-cream p-3">
                  {!locked && row.administers > 0 ? (
                    <p className="mb-2 text-sm font-bold text-pana-ink">
                      This account administers {row.administers} listing
                      {row.administers === 1 ? '' : 's'}. They stay live and
                      visible — locking the owner does not delist them.
                    </p>
                  ) : null}
                  <label
                    className="block text-xs font-bold text-pana-ink/70"
                    htmlFor={`reason-${row.id}`}
                  >
                    Why? Recorded against your name, and shown on appeal.
                  </label>
                  <textarea
                    id={`reason-${row.id}`}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border-2 border-pana-ink/20 bg-white px-3 py-2 text-sm text-pana-ink"
                    placeholder={
                      locked
                        ? 'Appeal upheld — reported account was not theirs.'
                        : 'Repeated spam listings after two warnings.'
                    }
                  />
                  {error ? (
                    <p className="mt-2 text-sm font-bold text-pana-red-deep">
                      {error}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={busy || reason.trim().length < REASON_MIN}
                      onClick={() => submit(row)}
                      className="rounded-full border-2 border-pana-ink bg-pana-ink px-4 py-1.5 text-xs font-extrabold text-pana-cream disabled:opacity-40"
                    >
                      {busy
                        ? 'Working…'
                        : locked
                          ? 'Unlock account'
                          : 'Lock and end sessions'}
                    </button>
                    <span className="text-xs text-pana-ink/60">
                      {reason.trim().length < REASON_MIN
                        ? `${REASON_MIN - reason.trim().length} more characters`
                        : locked
                          ? 'They will be able to sign in again.'
                          : 'Signs them out everywhere, immediately.'}
                    </span>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
