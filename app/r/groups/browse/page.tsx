import type { Metadata } from 'next';
import Link from 'next/link';
import { BrowseGroups } from '@/components/relay/groups/BrowseGroups';

export const metadata: Metadata = {
  title: 'Browse Groups - Pana Resilience Network',
  description: 'Community relay groups open to all Pana MIA members.',
};

export default function BrowseGroupsPage() {
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <p className="text-muted-foreground mb-2 text-sm">
            <Link href="/r/groups" className="underline">
              Your groups
            </Link>
          </p>
          <h1 className="text-3xl font-bold">Groups open to all panas</h1>
          <p className="text-muted-foreground mt-2">
            Anyone with a key can join these. Invite-only groups aren&rsquo;t
            listed here — you reach those through an invitation.
          </p>
        </header>

        <BrowseGroups />
      </div>
    </div>
  );
}
