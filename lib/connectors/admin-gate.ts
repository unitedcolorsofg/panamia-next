import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import { redirectToSignIn } from '@/lib/signin-redirect';

/**
 * The gate every Connectors admin page sits behind.
 *
 * Nothing under `/admin` is guarded by middleware or by the layout — each page
 * checks for itself. That was fine when this was one page. Splitting it into
 * three turns a single check into three copies of a check, and three copies is
 * how one of them ends up subtly different: a `redirect` where the others
 * `notFound`, or a new fourth page shipped with no gate at all because the
 * pattern was never named.
 *
 * So it is named. A new page under `app/admin/connectors/` that forgets to
 * call this is obviously wrong in review, in a way that a page which simply
 * lacks six lines of boilerplate is not.
 *
 * ## Two failures, two answers
 *
 * Signed out is most likely a staff member whose session expired, so they get
 * sent to sign in and can come back. Signed in without admin is somebody who
 * should not know this exists, so it does not: `notFound()` rather than a
 * "forbidden" page, because telling a stranger they have found a real admin
 * route they lack rights for is itself a disclosure.
 *
 * "Can come back" is the part that needs `callbackUrl`, and it is required
 * rather than optional because this gate previously sent expired staff to a
 * bare `/signin`, which dropped them on the directory afterwards with no
 * route back to the console they were using.
 *
 * Throws through Next's control-flow helpers and so never returns on failure;
 * callers can treat a return as proof of an admin session.
 */
export async function requireConnectorsAdmin(callbackUrl: string) {
  const session = await auth();
  if (!session?.user?.id) redirectToSignIn(callbackUrl);
  if (!session.user.isAdmin) notFound();
  return session;
}
