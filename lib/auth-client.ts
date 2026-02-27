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
} from 'better-auth/client/plugins';
import type { AppSession } from '@/auth';

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), genericOAuthClient()],
});

// ── useSession ───────────────────────────────────────────────────────────────
// Returns { data: AppSession | null, status: 'loading' | 'authenticated' | 'unauthenticated' }

export function useSession(): {
  data: AppSession | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
} {
  const { data, isPending } = authClient.useSession();

  if (isPending) {
    return { data: null, status: 'loading' };
  }

  if (!data) {
    return { data: null, status: 'unauthenticated' };
  }

  return {
    data: {
      user: {
        id: data.user.id,
        email: data.user.email,
        emailVerified: data.user.emailVerified ? new Date() : null,
        name: '',
        image: '',
        isAdmin: false,
        panaVerified: false,
        legalAgeVerified: false,
        isMentoringModerator: false,
        isEventOrganizer: false,
        isContentModerator: false,
      },
      expires: data.session.expiresAt.toISOString(),
    },
    status: 'authenticated',
  };
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
