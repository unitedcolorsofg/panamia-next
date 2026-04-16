'use client';

/**
 * Compatibility shim: next-auth/react → better-auth/react
 *
 * Exports useSession, signIn, signOut, and SessionProvider with the same
 * call signatures as next-auth/react so client files need only a one-line
 * import change.
 */

import { createAuthClient } from 'better-auth/react';
import {
  magicLinkClient,
  genericOAuthClient,
  customSessionClient,
} from 'better-auth/client/plugins';
import { useMemo } from 'react';
import type { AppSession, BetterAuthServer } from '@/auth';

export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    genericOAuthClient(),
    customSessionClient<BetterAuthServer>(),
  ],
});

// ── useSession ───────────────────────────────────────────────────────────────
// Returns { data: AppSession | null, status: 'loading' | 'authenticated' | 'unauthenticated' }
//
// The return value is memoized on the underlying session/user identity so
// callers that pass `session` (or `session.user`) into a useEffect dep array
// don't re-fire on every render. Without this, any setState in the consumer
// triggers a render → new object literal → effect refires → setState → loop.

export function useSession(): {
  data: AppSession | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
} {
  const { data, isPending } = authClient.useSession();

  // data.user is extended by customSession (server-side) with enriched fields
  const u = data?.user as
    | (NonNullable<typeof data>['user'] & {
        isAdmin?: boolean;
        panaVerified?: boolean;
        legalAgeVerified?: boolean;
        isMentoringModerator?: boolean;
        isEventOrganizer?: boolean;
        isContentModerator?: boolean;
      })
    | undefined;

  // Pull primitives out so useMemo deps are stable across renders.
  const userId = u?.id;
  const userEmail = u?.email;
  const emailVerified = u?.emailVerified ?? false;
  const isAdmin = u?.isAdmin ?? false;
  const panaVerified = u?.panaVerified ?? false;
  const legalAgeVerified = u?.legalAgeVerified ?? false;
  const isMentoringModerator = u?.isMentoringModerator ?? false;
  const isEventOrganizer = u?.isEventOrganizer ?? false;
  const isContentModerator = u?.isContentModerator ?? false;
  const expiresAtMs = data?.session.expiresAt
    ? new Date(data.session.expiresAt).getTime()
    : 0;

  return useMemo(() => {
    if (isPending) {
      return { data: null, status: 'loading' as const };
    }
    if (!userId) {
      return { data: null, status: 'unauthenticated' as const };
    }
    return {
      data: {
        user: {
          id: userId,
          email: userEmail,
          emailVerified: emailVerified ? new Date() : null,
          name: '',
          image: '',
          isAdmin,
          panaVerified,
          legalAgeVerified,
          isMentoringModerator,
          isEventOrganizer,
          isContentModerator,
        },
        expires: new Date(expiresAtMs).toISOString(),
      } as AppSession,
      status: 'authenticated' as const,
    };
  }, [
    isPending,
    userId,
    userEmail,
    emailVerified,
    isAdmin,
    panaVerified,
    legalAgeVerified,
    isMentoringModerator,
    isEventOrganizer,
    isContentModerator,
    expiresAtMs,
  ]);
}

// ── signIn ───────────────────────────────────────────────────────────────────
// Matches next-auth/react: signIn(provider?, options?)

export async function signIn(
  provider?: string,
  options?: {
    email?: string;
    callbackUrl?: string;
    redirect?: boolean;
    [key: string]: unknown;
  }
): Promise<void> {
  const callbackURL = options?.callbackUrl ?? '/';

  if (provider === 'email' || provider === 'nodemailer') {
    // Magic link sign-in
    await authClient.signIn.magicLink({
      email: options?.email ?? '',
      callbackURL,
    });
    return;
  }

  if (provider) {
    // Social / OAuth sign-in
    await authClient.signIn.social({
      provider: provider as Parameters<
        typeof authClient.signIn.social
      >[0]['provider'],
      callbackURL,
    });
  }
}

// ── signOut ──────────────────────────────────────────────────────────────────
// Matches next-auth/react: signOut(options?)

export async function signOut(options?: {
  redirect?: boolean;
  callbackUrl?: string;
}): Promise<void> {
  const callbackURL = options?.callbackUrl ?? '/';
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        if (options?.redirect !== false && typeof window !== 'undefined') {
          window.location.href = callbackURL;
        }
      },
    },
  });
}

// ── SessionProvider ──────────────────────────────────────────────────────────
// better-auth does not require a provider wrapper. This is a passthrough shim
// so existing code that renders <SessionProvider> continues to compile.

export function SessionProvider({
  children,
}: {
  children: React.ReactNode;
  session?: AppSession | null;
}) {
  return children as React.ReactElement;
}
