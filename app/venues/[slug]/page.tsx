import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { venues, events } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { MapPin, Globe, Car } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const venue = await db.query.venues.findFirst({
    where: eq(venues.slug, slug),
    columns: { name: true, city: true, state: true },
  });
  return { title: venue ? `${venue.name} | Venues | Panamia Club` : 'Venue' };
}

export default async function VenuePage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const isAdmin = session?.user?.isAdmin || false;

  const venue = await db.query.venues.findFirst({
    where: eq(venues.slug, slug),
  });
  if (!venue) notFound();
  if (venue.status !== 'active' && !isAdmin) notFound();

  const upcomingEvents = await db.query.events.findMany({
    where: and(eq(events.venueId, venue.id), eq(events.status, 'published')),
    orderBy: (t, { asc }) => [asc(t.startsAt)],
    limit: 10,
    columns: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      timezone: true,
      attendeeCount: true,
    },
  });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/venues"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Back to Venues
      </Link>

      <div className="mt-4">
        <div className="flex items-start justify-between">
          <h1 className="text-3xl font-bold">{venue.name}</h1>
          {isAdmin && venue.status !== 'active' && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-800 capitalize">
              {venue.status.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              {venue.address}, {venue.city}, {venue.state}{' '}
              {venue.postalCode || ''}, {venue.country}
            </span>
          </div>
          {venue.website && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="text-muted-foreground h-4 w-4 flex-shrink-0" />
              <a
                href={venue.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {venue.website}
              </a>
            </div>
          )}
          {venue.parkingOptions !== 'none' && (
            <div className="flex items-center gap-2 text-sm">
              <Car className="text-muted-foreground h-4 w-4 flex-shrink-0" />
              <span className="capitalize">{venue.parkingOptions} parking</span>
            </div>
          )}
          {venue.capacity && (
            <p className="text-muted-foreground text-sm">
              Capacity: {venue.capacity}
            </p>
          )}
          {venue.accessibilityNotes && (
            <p className="text-muted-foreground text-sm">
              Accessibility: {venue.accessibilityNotes}
            </p>
          )}
        </div>
      </div>

      {upcomingEvents.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Upcoming Events Here</h2>
          <div className="mt-3 space-y-2">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/e/${event.slug}`}
                className="hover:bg-accent flex items-center justify-between rounded-lg border p-3"
              >
                <span className="font-medium">{event.title}</span>
                <span className="text-muted-foreground text-sm">
                  {new Date(event.startsAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: event.timezone || 'America/New_York',
                  })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
