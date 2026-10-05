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
import { useQueryClient } from '@tanstack/react-query';
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
  /**
   * Where this listing stands with review. `active: false` alone cannot say,
   * because it covers both "nobody has looked yet" and "declined" — see
   * lib/server/profile-owners.ts.
   */
  reviewState?: 'published' | 'pending' | 'inactive';
}

/**
 * A listing that named this account's address as its owner at intake, waiting
 * to be accepted or dismissed.
 *
 * Not an identity: nothing has been granted yet. The address was typed into a
 * public form by someone who may or may not have been telling the truth, so it
 * only becomes ownership when the person who actually holds the inbox says so.
 */
export interface PendingInvitation {
  profileId: string;
  name: string;
  /** Masked — the full business address is not this account's to read yet. */
  businessEmail: string | null;
  active: boolean | null;
}

interface IdentityState {
  identities: Identity[];
  activeId: string | null;
  active: Identity | null;
  /** The user's own profile, whatever they are currently acting as. */
  personal: Identity | null;
  /** Listings claiming this account's address, awaiting a yes or no. */
  invitations: PendingInvitation[];
  loading: boolean;
  /**
   * True when the lookup gave up after its retries. Distinct from an empty
   * list: "this account has no profile yet" invites a setup nudge, while "we
   * could not ask" must not, or a dropped connection would tell an established
   * member their account is unfinished.
   */
  failed: boolean;
  switching: string | null;
  /** The invitation currently being answered, if any. */
  answering: string | null;
  error: string | null;
  switchTo: (profileId: string) => Promise<void>;
  answerInvitation: (
    profileId: string,
    action: 'accept' | 'decline'
  ) => Promise<void>;
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
  invitations: PendingInvitation[];
}> {
  try {
    const res = await axios.get('/api/profile/switch');
    return {
      identities: res.data?.data ?? [],
      activeId: res.data?.activeProfileId ?? null,
      invitations: res.data?.pendingInvitations ?? [],
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
  const queryClient = useQueryClient();
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIdentities([]);
      setActiveId(null);
      setInvitations([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);

    fetchIdentities()
      .then(({ identities: list, activeId: active, invitations: pending }) => {
        if (cancelled) return;
        setIdentities(list);
        setActiveId(active);
        setInvitations(pending);
      })
      .catch(() => {
        if (cancelled) return;
        setIdentities([]);
        setInvitations([]);
        setFailed(true);
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
        /* Client-cached social data is keyed on a handle, not on who is
           asking, and several of those responses are viewer-scoped — Mutual
           Panas names people, and isSelf/isFollowing decide which buttons a
           profile shows. With a 60s staleTime, a switch would otherwise leave
           the new identity looking at the old one's answers. router.refresh()
           does not touch this cache, so it has to be dropped here. */
        queryClient.clear();
        // Profile-scoped data is keyed on the cookie server-side, so the
        // refresh is what actually swaps the page over.
        router.refresh();
      } catch {
        setError('Could not switch. Please try again.');
      } finally {
        setSwitching(null);
      }
    },
    [activeId, queryClient, router, switching]
  );

  const answerInvitation = useCallback(
    async (profileId: string, action: 'accept' | 'decline') => {
      if (answering) return;
      setAnswering(profileId);
      setError(null);
      try {
        await axios.post('/api/listings/pending', { profileId, action });
        // Gone from the prompt either way — accepted it is an identity now,
        // declined it is nothing to this account.
        setInvitations((prev) => prev.filter((i) => i.profileId !== profileId));
        if (action === 'accept') {
          // Re-read rather than synthesising a row: the server decides the
          // role and the review state, and guessing them here would make the
          // menu disagree with the next page load.
          const next = await fetchIdentities();
          setIdentities(next.identities);
          setActiveId(next.activeId);
          setInvitations(next.invitations);
        }
      } catch (err) {
        const message =
          axios.isAxiosError(err) &&
          typeof err.response?.data?.error === 'string'
            ? err.response.data.error
            : 'Could not save that. Please try again.';
        setError(message);
        // Left in place on failure: it is still a real invitation, and
        // removing it would strand someone with no way to try again.
      } finally {
        setAnswering(null);
      }
    },
    [answering]
  );

  const value = useMemo<IdentityState>(() => {
    const active = identities.find((i) => i.id === activeId) ?? null;
    return {
      identities,
      activeId,
      active,
      personal: identities.find((i) => i.isPersonal) ?? null,
      invitations,
      loading,
      failed,
      switching,
      answering,
      error,
      switchTo,
      answerInvitation,
      clearError: () => setError(null),
    };
  }, [
    identities,
    activeId,
    invitations,
    loading,
    failed,
    switching,
    answering,
    error,
    switchTo,
    answerInvitation,
  ]);

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
