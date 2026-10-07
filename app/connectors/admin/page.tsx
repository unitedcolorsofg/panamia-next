import { redirect } from 'next/navigation';

/**
 * Where the connector admin console used to be.
 *
 * It moved to `/admin/connectors`, on the admin surface, because of who it is
 * for rather than what it is about: Connectors is a members' surface and this
 * was the one page on it that most signed-in connectors would be refused.
 *
 * The old path keeps answering because it was linked from HQ, from the mock's
 * viewer switch and from whatever the panas pasted into threads while they
 * were reviewing it. A redirect costs one file; a dead link costs somebody
 * ten minutes working out whether the feature was removed.
 *
 * Any `?as=` on the old URL is dropped rather than carried. The admin surface
 * has no viewer roles — it is staff or nothing — so the parameter would mean
 * nothing on arrival.
 */

export default function MovedConnectorAdminPage() {
  redirect('/admin/connectors');
}
