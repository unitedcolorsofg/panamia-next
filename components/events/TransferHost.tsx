'use client';

/**
 * Hand an event to a different host.
 *
 * Only rendered for someone who may actually transfer -- the personal host, or
 * an admin of the hosting group. The page decides that; this component does
 * not re-derive it.
 *
 * The one sharp edge here is worth spelling out. You may *host* as a group you
 * moderate, but you may only *transfer away* from a group you admin. So moving
 * your own event into a group where you are merely a moderator is a one-way
 * door: afterwards the group owns it and you personally cannot take it back.
 * That is the correct rule -- a moderator should not be able to walk off with
 * the group's events -- but it is not something anyone would guess from a
 * dropdown, so we say it before they commit rather than after.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface HostGroupOption {
  id: string;
  handle: string;
  name: string;
  role: string;
}

interface TransferHostProps {
  slug: string;
  /** The group hosting today, or null when a person hosts. */
  currentHostGroupId: string | null;
}

const SELF = '__self__';

export function TransferHost({ slug, currentHostGroupId }: TransferHostProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<HostGroupOption[]>([]);
  const [target, setTarget] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/social/actors/me/groups')
      .then((r) => r.json())
      .then((d) => {
        if (!active || !d.success) return;
        // Presentation only; the route recomputes this before it writes.
        setGroups(
          (d.data.groups as HostGroupOption[]).filter(
            (g) => g.role === 'admin' || g.role === 'moderator'
          )
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Everywhere the event could go that is not where it already is.
  const options = [
    ...(currentHostGroupId ? [{ value: SELF, label: 'Myself' }] : []),
    ...groups
      .filter((g) => g.id !== currentHostGroupId)
      .map((g) => ({ value: g.id, label: g.name })),
  ];

  const selectedGroup = groups.find((g) => g.id === target);
  const oneWay = selectedGroup?.role === 'moderator';

  async function handleTransfer() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${slug}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostGroupId: target === SELF ? null : target,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Transfer failed');
        return;
      }
      router.refresh();
      setTarget('');
    } catch {
      setError('Transfer failed');
    } finally {
      setBusy(false);
    }
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        You have no other group to hand this event to.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        aria-label="New host"
      >
        <option value="">Choose a new host…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {oneWay && (
        <p className="text-sm text-amber-700">
          You are a moderator of {selectedGroup?.name}, not an admin. Once it
          hosts this event you will not be able to transfer it back yourself.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button size="sm" onClick={handleTransfer} disabled={!target || busy}>
        {busy ? 'Transferring…' : 'Transfer event'}
      </Button>
    </div>
  );
}
