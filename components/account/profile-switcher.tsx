'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface AdministeredProfile {
  id: string;
  name: string;
  email: string | null;
  active: boolean | null;
  isPersonal: boolean;
}

/**
 * "Acting as" switcher.
 *
 * One login can administer several profiles — the person's own, plus any
 * business listings they've claimed. Switching sets a server-side cookie that
 * every profile-scoped route reads, so the rest of the account area (and
 * posting) follows along without passing ids through the URL.
 *
 * Renders nothing when there's only one profile, so solo accounts never see
 * chrome for a choice they don't have.
 */
export function ProfileSwitcher() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<AdministeredProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [list, me] = await Promise.all([
          axios.get('/api/profile/switch'),
          axios.get('/api/social/actors/me'),
        ]);
        if (cancelled) return;
        setProfiles(list.data?.data ?? []);
        setActiveId(me.data?.data?.profileId ?? null);
      } catch {
        // A failure here just means no switcher; the page still works.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function switchTo(profileId: string) {
    if (profileId === activeId) return;
    setSwitching(profileId);
    setError(null);
    try {
      await axios.post('/api/profile/switch', { profileId });
      setActiveId(profileId);
      // Server components and profile-scoped data are keyed on the cookie, so
      // a refresh is what actually swaps the page over.
      router.refresh();
    } catch {
      setError('Could not switch profiles. Please try again.');
    } finally {
      setSwitching(null);
    }
  }

  if (profiles.length < 2) return null;

  return (
    <div className="border-pana-flame/30 bg-pana-butter-2/40 mb-6 rounded-xl border p-4">
      <p className="text-pana-ink/70 mb-3 text-sm font-semibold tracking-wide uppercase">
        Acting as
      </p>

      <div className="flex flex-wrap gap-2">
        {profiles.map((profile) => {
          const isActive = profile.id === activeId;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => switchTo(profile.id)}
              disabled={switching !== null}
              aria-pressed={isActive}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                isActive
                  ? 'border-pana-burnt bg-pana-flame text-white'
                  : 'border-pana-flame/40 text-pana-ink hover:bg-pana-flame/10 bg-white'
              }`}
            >
              {profile.name}
              <span className="ml-2 text-xs opacity-70">
                {profile.isPersonal ? 'You' : 'Business'}
              </span>
              {profile.active === false && (
                <span className="ml-2 text-xs opacity-70">(inactive)</span>
              )}
              {switching === profile.id && (
                <span className="ml-2 text-xs">…</span>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
