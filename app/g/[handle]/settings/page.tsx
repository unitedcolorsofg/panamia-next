import { notFound } from 'next/navigation';
import { getGroupByHandle } from '@/lib/federation';
import { GroupSettingsView } from './_components/group-settings-view';

/**
 * A group's settings: /g/<handle>/settings
 *
 * Today this page holds exactly one thing -- deleting the group. Editing a
 * group's name, rules, topics and join policy is still unbuilt, and this is
 * where that will land.
 *
 * Deletion needed a home that is not the group page itself. Putting an
 * irreversible action on the page everyone reads means the only thing
 * separating a member from destroying the group is their role check passing
 * or failing on a button they can see. A separate route that admins navigate
 * to deliberately is the ordinary shape for this.
 *
 * Not cached, and never indexed: it is viewer-dependent and admin-only.
 */

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { handle } = await params;
  return {
    title: `Settings | @${handle}`,
    robots: { index: false, follow: false },
  };
}

export default async function GroupSettingsPage({ params }: PageProps) {
  const { handle } = await params;

  const found = await getGroupByHandle(handle);
  if (!found) notFound();

  /* Authorization is not done here. The view fetches the group with the
     session in hand and renders nothing dangerous to a non-admin, and both
     endpoints behind it re-check the role server-side. A server-side check
     here as well would be a third copy of the same rule. */
  return <GroupSettingsView handle={handle} />;
}
