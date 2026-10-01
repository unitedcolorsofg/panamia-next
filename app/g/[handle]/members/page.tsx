import { notFound } from 'next/navigation';
import { getGroupByHandle } from '@/lib/federation';
import { GroupMembersView } from './_components/group-members-view';

/**
 * A group's full roster: /g/<handle>/members
 *
 * The group page carries an abridged version of this; four hundred rows in
 * the middle of a page somebody is reading to decide whether to join would
 * bury everything under them.
 *
 * It is also the surface the management controls will hang off when they
 * land -- approving a request, promoting a moderator and removing a member
 * all need a row to act on and room for the action, which is exactly this
 * page with buttons in it.
 *
 * Authorization is not done here. The view fetches the roster with the
 * session in hand, and the endpoint behind it withholds a private group's
 * members from a non-member server-side. A check here as well would be a
 * second copy of a rule whose whole point is having one copy.
 */

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { handle } = await params;
  const found = await getGroupByHandle(handle);
  const name = found?.actor.name || `@${handle}`;

  /* Not indexed. The roster is viewer-dependent -- a private group serves a
     different page to a member than to a stranger -- and a crawler would
     cache whichever one it happened to get. */
  return {
    title: `Members | ${name}`,
    robots: { index: false, follow: false },
  };
}

export default async function GroupMembersPage({ params }: PageProps) {
  const { handle } = await params;

  const found = await getGroupByHandle(handle);
  if (!found) notFound();

  return <GroupMembersView handle={handle} />;
}
