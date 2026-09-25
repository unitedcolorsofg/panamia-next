import { notFound } from 'next/navigation';
import { getGroupByHandle } from '@/lib/federation';
import { GroupView } from './_components/group-view';

/**
 * A group's home page: /g/<handle>
 *
 * Top level rather than under /s -- see the note on the social surface's
 * `paths` in lib/panaverse/surfaces.ts. /p/<user> is a person, /g/<handle> is
 * a group, and both survive the eventual move of the social root to "/".
 *
 * Deliberately NOT cached with `revalidate`, unlike /p/<user>. What this page
 * shows depends on who is asking -- a private group renders a locked panel to
 * a stranger and its contents to a member -- so a shared edge cache would hand
 * one viewer's answer to the next. The viewer-dependent half therefore lives
 * in a client component that fetches with the session in hand, and the server
 * half stays to the identity fields that are public for every group.
 *
 * @see docs/GROUPS-ROADMAP.md
 * @see app/mock/group
 */

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { handle } = await params;
  const found = await getGroupByHandle(handle);

  if (!found) {
    return { title: 'Group Not Found' };
  }

  const { group, actor } = found;
  const name = actor.name || handle;

  return {
    title: `${name} | Pana Social`,
    description: actor.summary || `${name} on Pana Social.`,
    /* A private group is identifiable on purpose -- you cannot ask to join
       something you cannot find -- but identifiable to a person searching is
       not the same as listed in Google forever. Public groups index; private
       ones are reachable by handle and nowhere else. */
    robots:
      group.visibility === 'private'
        ? { index: false, follow: false }
        : undefined,
  };
}

export default async function GroupPage({ params }: PageProps) {
  const { handle } = await params;

  /* Resolved here as well as in generateMetadata so a bad handle is a real
     404 with a 404 status, rather than a 200 carrying an error message that
     a crawler would happily index. */
  const found = await getGroupByHandle(handle);
  if (!found) notFound();

  return <GroupView handle={handle} />;
}
