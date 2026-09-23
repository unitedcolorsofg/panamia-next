'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import ScreennamePrompt from '@/components/ScreennamePrompt';

/**
 * Prompts a signed-in user who has no screenname to claim one.
 *
 * A screenname is what creates the user's profile (see
 * app/api/user/screenname/set/route.ts), and the profile is what social
 * identity hangs off — social_actors references profiles, so an account
 * without one can browse but can never post, follow, or be followed.
 *
 * Before this, the only screenname prompt in the product was on the "new
 * article" page, so anyone who signed in to browse the directory or use Pana
 * Social silently never got a profile. Living in the root layout is what makes
 * this cover every route in, rather than just the sign-in page: magic links,
 * OAuth callbacks and already-existing accounts all land somewhere arbitrary.
 *
 * Deliberately skippable. Claiming a screenname is a 90-day-cooldown decision
 * (SCREENNAME_COOLDOWN_DAYS), so pressuring a first-time visitor into one to
 * get past a modal is worse than asking again later. Dismissal is remembered
 * for the browser session so it asks once, not on every navigation.
 */

const DISMISS_KEY = 'pana:screenname-prompt-dismissed';

export default function ScreennameGate() {
  const { data: session, status } = useSession();
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  // Which user id we've already looked up, so a sign-out/sign-in in the same
  // tab re-checks rather than reusing the previous user's answer.
  const checkedFor = useRef<string | null>(null);

  const userId = session?.user?.id;

  useEffect(() => {
    if (status !== 'authenticated' || !userId) {
      return;
    }
    if (checkedFor.current === userId) {
      return;
    }
    checkedFor.current = userId;

    if (sessionStorage.getItem(DISMISS_KEY) === userId) {
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch('/api/user/me', {
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (payload?.success && !payload.data?.screenname?.trim()) {
          setOpen(true);
        }
      } catch {
        // Offline, aborted, or the session lapsed mid-flight. Staying silent is
        // correct — this is a nudge, not a gate, and there is nothing the user
        // could do about a failure here anyway.
      }
    })();

    return () => controller.abort();
  }, [status, userId]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next && userId) {
        sessionStorage.setItem(DISMISS_KEY, userId);
      }
    },
    [userId]
  );

  const handleSuccess = useCallback(() => {
    setOpen(false);
  }, []);

  if (status !== 'authenticated') {
    return null;
  }

  return (
    <ScreennamePrompt
      open={open}
      onOpenChange={handleOpenChange}
      onSuccess={handleSuccess}
      title={t('onboarding.screennameTitle')}
      description={t('onboarding.screennameDescription')}
    />
  );
}
