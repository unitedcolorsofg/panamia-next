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
 * `?as=` is carried across so a link that was previewing a particular role
 * still previews it after the hop — the admin surface reads the same
 * parameter, though it only recognises `visitor`.
 */

export default async function MovedConnectorAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  redirect(as ? `/admin/connectors?as=${encodeURIComponent(as)}` : '/admin/connectors');
}
