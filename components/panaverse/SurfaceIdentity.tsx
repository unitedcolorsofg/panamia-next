'use client';

import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { IdentityProvider } from '@/components/account/identity-provider';
import { IdentityMenu } from '@/components/account/identity-menu';

/**
 * The account control in a surface masthead — the same one the main site flies.
 *
 * Pana Social used to wear a plain link to the member's own profile. That was
 * written when the main masthead had no identity menu to copy (#187 had just
 * removed it), and it left the two sites answering "who am I signed in as"
 * with different controls. One account across the panaverse should mean one
 * account control, in the same corner, opening the same panel.
 *
 * This exists as its own island because `IdentityProvider` is mounted inside
 * `MainHeader`, which no surface renders — and `IdentityMenu` returns `null`
 * when the provider is missing rather than throwing. Dropped straight into the
 * surface masthead it would have rendered nothing at all, silently: the bubble
 * would simply have been absent, which reads as "signed out" rather than as a
 * wiring mistake. The provider therefore travels with the menu.
 *
 * Renders nothing while the session resolves, which is what the main masthead
 * does. It costs no layout shift here because the bar is a `1fr auto 1fr` grid
 * — the empty column still holds its half, so the mark stays on the page axis.
 */
export function SurfaceIdentity() {
  const { data: session, status } = useSession();
  const signedIn = status !== 'loading' && !!session;

  return (
    <IdentityProvider enabled={signedIn}>
      {/* A surface keeps its own quiet sign-in link rather than the main
          site's join CTA. That button sells a Pana Mia account to someone who
          has not got one; a visitor reading a timeline has already arrived
          somewhere and only needs the way in. */}
      {status !== 'loading' && !session && (
        <Link href="/signin" className="panaverse-guest-link">
          Sign in
        </Link>
      )}

      {signedIn && <IdentityMenu />}
    </IdentityProvider>
  );
}
