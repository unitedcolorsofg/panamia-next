'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Loader2, Check } from 'lucide-react';

// Mirrors external/nostrlab's RsvpButtons going/maybe/can't-go UX, but instead
// of signing a Nostr event it posts to the web API. Anonymous visitors confirm
// via a magic-link email (no account, no Nostr key); logged-in users count
// immediately.

type Status = 'going' | 'maybe' | 'not_going';

const OPTIONS: { value: Status; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_going', label: "Can't go" },
];

interface Props {
  slug: string;
  capacity?: number | null;
  goingCount: number;
  initialStatus?: Status | null;
  full?: boolean;
}

export default function RsvpForm({
  slug,
  capacity,
  goingCount,
  initialStatus,
  full,
}: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const loggedIn = !!session?.user;

  const [status, setStatus] = useState<Status | null>(initialStatus ?? null);
  const [busy, setBusy] = useState<Status | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(s: Status) {
    setErr(null);
    // Anonymous "going"/"maybe" needs name + email for the magic link.
    if (!loggedIn && !pendingEmail && s !== 'not_going') {
      // Reveal the email capture for the chosen status.
      setStatus(s);
      setPendingEmail(true);
      return;
    }
    setBusy(s);
    try {
      const res = await fetch(`/api/events/${slug}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          loggedIn ? { status: s } : { status: s, name, email }
        ),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(
          data.code === 'MAX_CAPACITY'
            ? 'This event is at capacity.'
            : data.error || 'Could not RSVP'
        );
      }
      if (data.data?.pending) {
        setErr(null);
        setStatus(s);
        setPendingEmail(false);
        setName('');
        setEmail('');
        // Surface the "check your email" confirmation.
        setConfirmSent(true);
      } else {
        setStatus(s);
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not RSVP');
    } finally {
      setBusy(null);
    }
  }

  if (confirmSent) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
        <Check className="mr-1 inline h-4 w-4" />
        Check your email to confirm your RSVP. It won&apos;t count until you do.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const isFullBlock =
            full && opt.value === 'going' && status !== 'going';
          return (
            <Button
              key={opt.value}
              type="button"
              variant={status === opt.value ? 'default' : 'outline'}
              disabled={busy !== null || isFullBlock}
              onClick={() => submit(opt.value)}
              className={cn(status === opt.value && 'ring-2 ring-offset-1')}
            >
              {busy === opt.value && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isFullBlock ? 'Full' : opt.label}
            </Button>
          );
        })}
      </div>

      <p className="text-sm text-gray-500">
        {goingCount} going{capacity ? ` · ${capacity} capacity` : ''}
      </p>

      {!loggedIn && pendingEmail && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No account needed — we&apos;ll email you a link to confirm.
          </p>
          <div className="space-y-2">
            <Label htmlFor="rsvp-name">Your name</Label>
            <Input
              id="rsvp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jordan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rsvp-email">Email</Label>
            <Input
              id="rsvp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Button
            type="button"
            disabled={busy !== null || !name.trim() || !email.trim()}
            onClick={() => status && submit(status)}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send confirmation
          </Button>
        </div>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
