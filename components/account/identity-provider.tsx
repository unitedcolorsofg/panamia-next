'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export interface Identity {
  id: string;
  name: string;
  email: string | null;
  screenname: string | null;
  active: boolean | null;
  isPersonal: boolean;
  role: 'owner' | 'manager' | string;
  primaryImageCdn?: string | null;
}

interface IdentityState {
  identities: Identity[];
  activeId: string | null;
  active: Identity | null;
  /** The user's own profile, whatever they are currently acting as. */
  personal: Identity | null;
  loading: boolean;
  switching: string | null;
  error: string | null;
  switchTo: (profileId: string) => Promise<void>;
  clearError: () => void;
}

const IdentityContext = createContext<IdentityState | null>(null);

/** A 401 means "signed out", which is an answer, not a failure worth retrying. */
function isDefinitive(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 401;
}

async function fetchIdentities(attempt = 0): Promise<{
  identities: Identity[];
  activeId: string | null;
}> {
  try {
    const res = await axios.get('/api/profile/switch');
    return {
      identities: res.data?.data ?? [],
      activeId: res.data?.activeProfileId ?? null,
    };
  } catch (err) {
    if (attempt >= 2 || isDefinitive(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    return fetchIdentities(attempt + 1);
  }
}

/**
 * Shared "acting as" state for the whole shell.
 *
 * The masthead menu and the acting-as bar both need the same list and the same
 * current selection, so this fetches once and hands both of them the result
 * rather than each component calling the API on its own.
 *
 * Deliberately silent on failure: if the list can't be loaded the switcher
 * simply doesn't appear, which is much better than blocking the header on a
 * request that is irrelevant to most page views.
 *
 * That silence is only acceptable because the fetch retries first. Giving up on
 * the first error made a brief blip look identical to "this account has nothing
 * to switch between", so the switcher would vanish from the masthead until the
 * next full page load happened to succeed.
 */
export function IdentityProvider({
  enabled,
  children,
}: {
  /** Only signed-in visitors have identities to switch between. */
  enabled: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIdentities([]);
      setActiveId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchIdentities()
      .then(({ identities: list, activeId: active }) => {
        if (cancelled) return;
        setIdentities(list);
        setActiveId(active);
      })
      .catch(() => {
        if (!cancelled) setIdentities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const switchTo = useCallback(
    async (profileId: string) => {
      if (profileId === activeId || switching) return;
      setSwitching(profileId);
      setError(null);
      try {
        await axios.post('/api/profile/switch', { profileId });
        setActiveId(profileId);
        // Profile-scoped data is keyed on the cookie server-side, so the
        // refresh is what actually swaps the page over.
        router.refresh();
      } catch {
        setError('Could not switch. Please try again.');
      } finally {
        setSwitching(null);
      }
    },
    [activeId, router, switching]
  );

  const value = useMemo<IdentityState>(() => {
    const active = identities.find((i) => i.id === activeId) ?? null;
    return {
      identities,
      activeId,
      active,
      personal: identities.find((i) => i.isPersonal) ?? null,
      loading,
      switching,
      error,
      switchTo,
      clearError: () => setError(null),
    };
  }, [identities, activeId, loading, switching, error, switchTo]);

  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

/**
 * Returns null outside a provider, so components can be dropped anywhere
 * without the shell having to guarantee the provider is mounted.
 */
export function useIdentity(): IdentityState | null {
  return useContext(IdentityContext);
}
