import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { GroupsDashboard } from '@/components/relay/groups/GroupsDashboard';

export const metadata: Metadata = {
  title: 'Your Groups - Pana Resilience Network',
  description: 'Create and manage your groups on the Pana MIA community relay.',
};

// Signed-out visitors get the pitch and a sign-in link rather than a 401 from
// the API layer. Enrollment is checked inside GroupsDashboard, not here: an
// unenrolled member can still have invitations waiting, and seeing one is the
// reason to go enroll.
export default async function GroupsPage() {
  const session = await auth();

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <p className="text-muted-foreground mb-2 text-sm">
            <Link href="/r" className="underline">
              Pana Resilience Network
            </Link>
          </p>
          <h1 className="text-3xl font-bold">Your groups</h1>
          <p className="text-muted-foreground mt-2">
            Group chats you belong to on the community relay, and any
            invitations waiting for an answer.
          </p>
        </header>

        {session?.user?.id ? (
          <GroupsDashboard />
        ) : (
          <div className="rounded-lg border p-6">
            <p className="mb-4 text-sm">
              Sign in to see your groups and invitations.
            </p>
            <Button asChild>
              <Link href="/signin">Sign in</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
