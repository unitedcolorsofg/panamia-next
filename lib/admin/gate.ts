import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import { redirectToSignIn } from '@/lib/signin-redirect';

/**
 * The gate a server-rendered admin page sits behind.
 *
 * Nothing under `/admin` is guarded by middleware or by the layout — there is
 * no `middleware.ts` in this repo, and `app/admin/layout.tsx` renders the
 * sidebar without checking anything. Each page is its own boundary.
 *
 * That makes the check the single most copy-pasted thing on this surface, and
 * copies drift: a `redirect` where the others `notFound`, or a new page
 * shipped with no gate at all because the pattern was never named anywhere.
 * `lib/connectors/admin-gate.ts` was written to stop exactly that happening
 * across the three Connectors pages, and it worked — so this is that same
 * gate with the Connectors name taken off, because the reasoning was never
 * specific to Connectors.
 *
 * ## Two failures, two answers
 *
 * Signed out is most likely a staff member whose session expired, so they get
 * sent to sign in and can come back. Signed in without admin is somebody who
 * should not know this exists, so it does not: `notFound()` rather than a
 * "forbidden" page, because telling a stranger they have found a real admin
 * route they lack rights for is itself a disclosure.
 *
 * `callbackUrl` is required rather than optional. An earlier version of this
 * sent expired staff to a bare `/signin`, which dropped them on the directory
 * afterwards with no route back to the console they had been using.
 *
 * Throws through Next's control-flow helpers and so never returns on failure;
 * callers can treat a return as proof of an admin session.
 *
 * Note this is the *admin* gate, not the moderator one. `canSeeView` in
 * lib/admin/views.ts is what knows a tool can be opened up to the moderation
 * rota, and a page that wants that needs its own check — passing a moderator
 * through here would hand them every admin tool on the surface.
 */
export async function requireAdmin(callbackUrl: string) {
  const session = await auth();
  if (!session?.user?.id) redirectToSignIn(callbackUrl);
  if (!session.user.isAdmin) notFound();
  return session;
}
