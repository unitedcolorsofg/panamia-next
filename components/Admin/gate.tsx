'use client';

import type { ReactNode } from 'react';

import PageMeta from '@/components/PageMeta';
import { useSession } from '@/lib/auth-client';

/**
 * The staff check on every admin page that has one.
 *
 * ## What it fixes
 *
 * These pages used to gate on `if (!session)` — *signed in*, not *staff*. Any
 * member with an account rendered the full admin UI: the user list, the
 * moderation queues, the abuse reports. The data never arrived, because every
 * `/api/admin/*` route calls `checkAdminAuth()` server-side, so what a
 * non-admin actually got was the furniture with empty tables inside it. That
 * is not a data leak, but it is still wrong — it tells someone a tool exists,
 * invites them to use it, and then fails in a way that looks like a bug.
 *
 * `app/admin/mentoring` had no check at all.
 *
 * ## Why this is not the security boundary
 *
 * It cannot be. This is a client component; `session.user.isAdmin` arrives in
 * a payload the browser can edit. The boundary is `checkAdminAuth()` on the
 * API routes, and it stays there. This decides *what to draw*, which is a
 * different question from *what to serve*, and drawing admin chrome for
 * someone who can never fill it is the bug being fixed.
 *
 * A server-side gate in `app/admin/layout.tsx` would be stronger and was the
 * first instinct. It is not possible here: `/admin/profile/action` lives under
 * that layout and is deliberately unauthenticated — staff approve listings by
 * clicking a link in an email, routinely on a phone that is not signed in. A
 * layout gate would 404 that flow. App Router has no way to exempt one child
 * from its parent layout without a route group, and this project has none.
 *
 * ## Loading
 *
 * `useSession()` returns `data: null` with `status: 'loading'` during SSR and
 * the hydration render. The old `!session` test treated that as logged out, so
 * every admin page flashed UNAUTHORIZED before resolving. Checking `status`
 * first is what stops that, and is the reason this is a hook returning a node
 * rather than a plain boolean.
 *
 * ## Usage
 *
 * Call it with the other hooks, then return its node if non-null:
 *
 * ```tsx
 * const { gate } = useAdminGate();
 * // ...other hooks and handlers...
 * if (gate) return gate;
 * ```
 *
 * Returning early *before* a later hook would change hook order between
 * renders, so the call site is the existing early-return point, not the top of
 * the component.
 *
 * `allowed` is returned alongside because a page whose effect fetches on mount
 * needs a *stable* value to guard on. The node is fresh JSX on every render, so
 * putting it in a dependency array would re-fire the effect forever; `allowed`
 * is a boolean and does not.
 */
export function useAdminGate(options?: {
  /**
   * Which staff may pass. Defaults to `'admin'`.
   *
   * `'moderator'` additionally admits `isContentModerator`, for the one tool
   * that role exists to unlock — the abuse-report queue. Pass it only where
   * the matching API route calls `checkModeratorAuth()`, so that what is drawn
   * and what is served agree; a page that admits moderators while its route
   * still calls `checkAdminAuth()` renders the furniture and then 401s, which
   * is the exact failure this hook exists to prevent.
   */
  allow?: 'admin' | 'moderator';
}): { allowed: boolean; gate: ReactNode | null } {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return {
      allowed: false,
      gate: (
        <>
          <PageMeta title="Loading" desc="" />
          <p className="text-pana-ink/60 text-sm font-bold" role="status">
            Checking your access…
          </p>
        </>
      ),
    };
  }

  const permitted =
    session?.user?.isAdmin ||
    (options?.allow === 'moderator' && session?.user?.isContentModerator);

  if (!permitted) {
    return {
      allowed: false,
      gate: (
        <>
          <PageMeta title="Unauthorized" desc="" />
          <div>
            <h2 className="mb-6 text-3xl font-bold">UNAUTHORIZED</h2>
            {/* Deliberately the same sentence whether you are signed out or
                signed in without staff rights. Saying "you are not an admin"
                confirms to a logged-in stranger that they found a real staff
                page, which is a small thing to hand over for no benefit. */}
            <h3 className="text-xl">
              You do not have access to this page.{' '}
              <a className="underline underline-offset-4" href="/signin">
                Sign in
              </a>{' '}
              with a staff account.
            </h3>
          </div>
        </>
      ),
    };
  }

  return { allowed: true, gate: null };
}
