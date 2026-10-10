import { requireAdmin } from '@/lib/admin/gate';

/**
 * The gate every Connectors admin page sits behind.
 *
 * Now a thin alias for `requireAdmin` in lib/admin/gate.ts, which is this
 * function with the Connectors name taken off. The behaviour is unchanged and
 * the reasoning -- why `notFound()` rather than a forbidden page, why
 * `callbackUrl` is required -- moved there with it.
 *
 * Kept rather than replaced at the call sites. The name is doing real work in
 * `app/admin/connectors/*`: a page under that folder that does not call
 * something named for Connectors is obviously missing its gate in review,
 * which is the whole reason this was given a name in the first place.
 */
export async function requireConnectorsAdmin(callbackUrl: string) {
  return requireAdmin(callbackUrl);
}