import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import { db } from '@/lib/db';
import { venues } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const metadata = {
  title: 'Host an Event | Panamia Club',
};

export default async function NewEventPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  if (!session.user.panaVerified) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Verification Required</h1>
        <p className="text-muted-foreground mt-4">
          You must be a verified Pana to host events.{' '}
          <Link href="/form/become-a-pana" className="text-primary underline">
            Apply to become a Pana
          </Link>
          .
        </p>
      </div>
    );
  }

  const activeVenues = await db.query.venues.findMany({
    where: eq(venues.status, 'active'),
    orderBy: (t, { asc }) => [asc(t.city), asc(t.name)],
    columns: {
      id: true,
      slug: true,
      name: true,
      city: true,
      state: true,
      capacity: true,
    },
  });

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/e"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to Events
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Host an Event</h1>
        <p className="text-muted-foreground mt-2">
          All events are co-organized with Panamia Club per our{' '}
          <Link href="/tos" className="text-primary underline">
            Terms of Service
          </Link>
          . Events are free to attend.
        </p>
      </div>

      {activeVenues.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No approved venues are available yet.{' '}
            <Link href="/venues/new" className="text-primary underline">
              Submit a venue
            </Link>{' '}
            for admin review.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border p-6">
          <p className="text-muted-foreground">
            Event creation form coming soon. Use the API directly at{' '}
            <code className="bg-muted rounded px-1 text-sm">
              POST /api/events
            </code>
            .
          </p>
          <div className="mt-4">
            <p className="text-sm font-medium">
              Available venues ({activeVenues.length}):
            </p>
            <ul className="mt-2 space-y-1">
              {activeVenues.map((v) => (
                <li key={v.id} className="text-muted-foreground text-sm">
                  {v.name} — {v.city}, {v.state}
                  {v.capacity ? ` (cap: ${v.capacity})` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
