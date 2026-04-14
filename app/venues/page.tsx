import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { venues } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Venues | Panamia Club',
  description: 'Approved event venues for Panamia Club community events.',
};

export default async function VenuesPage() {
  const session = await auth();
  const isAdmin = session?.user?.isAdmin || false;

  const activeVenues = await db.query.venues.findMany({
    where: eq(venues.status, 'active'),
    orderBy: (t, { asc }) => [asc(t.city), asc(t.name)],
  });

  const pendingVenues = isAdmin
    ? await db.query.venues.findMany({
        where: eq(venues.status, 'pending_review'),
        orderBy: (t, { asc }) => [asc(t.createdAt)],
      })
    : [];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Venues</h1>
          <p className="text-muted-foreground mt-1">
            Approved venues for community events
          </p>
        </div>
        {session?.user?.panaVerified && (
          <Button asChild>
            <Link href="/form/submit-venue">Submit Venue</Link>
          </Button>
        )}
      </div>

      {isAdmin && pendingVenues.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            {pendingVenues.length} venue{pendingVenues.length !== 1 ? 's' : ''}{' '}
            pending review
          </p>
          <ul className="mt-2 space-y-1">
            {pendingVenues.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {v.name} — {v.city}, {v.state}
                </span>
                <div className="flex gap-2">
                  <Link
                    href={`/venues/${v.slug}`}
                    className="text-primary underline"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeVenues.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Building2 className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">No approved venues yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {activeVenues.map((venue) => (
            <Link
              key={venue.id}
              href={`/venues/${venue.slug}`}
              className="hover:bg-accent block rounded-lg border p-4 transition-colors"
            >
              <p className="font-semibold">{venue.name}</p>
              <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                <MapPin className="h-3.5 w-3.5" />
                <span>
                  {venue.city}, {venue.state}
                </span>
              </div>
              {venue.capacity && (
                <p className="text-muted-foreground mt-1 text-sm">
                  Capacity: {venue.capacity}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
