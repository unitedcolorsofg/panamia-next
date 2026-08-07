import type { Metadata } from 'next';
import Link from 'next/link';
import { GroupDetail } from '@/components/relay/groups/GroupDetail';

export const metadata: Metadata = {
  title: 'Group - Pana Resilience Network',
  description: 'Manage a group on the Pana MIA community relay.',
};

// The group is fetched client-side by GroupDetail rather than here, so that a
// group which 404s (deleted, or invite-only and not yours) renders the same
// "not found" state as any other, without a server round trip that would have
// to duplicate the visibility rules in lib/server/relay-groups.ts.
export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-muted-foreground mb-6 text-sm">
          <Link href="/r/groups" className="underline">
            Your groups
          </Link>
        </p>
        <GroupDetail groupId={groupId} />
      </div>
    </div>
  );
}
