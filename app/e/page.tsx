import Link from 'next/link';
import { CalendarDays, MapPin, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { events } from '@/lib/schema';
import { and, eq, inArray, gte } from 'drizzle-orm';

export const metadata = {
  title: 'Events | Panamia Club',
  description:
    'Discover in-person community events hosted by Panamia Club members.',
};

export default async function EventsPage() {
  const now = new Date();
  const upcomingEvents = await db.query.events.findMany({
    where: and(
      eq(events.status, 'published'),
      inArray(events.visibility, ['public']),
      gte(events.startsAt, now)
    ),
    orderBy: (t, { asc }) => [asc(t.startsAt)],
    limit: 20,
    with: {
      venue: { columns: { name: true, city: true, state: true } },
    },
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground mt-1">
            In-person community events organized with Panamia Club
          </p>
        </div>
        <Button asChild>
          <Link href="/e/new">
            <CalendarDays className="mr-2 h-4 w-4" />
            Host an Event
          </Link>
        </Button>
      </div>

      {upcomingEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <CalendarDays className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="text-xl font-semibold">No upcoming events</h2>
          <p className="text-muted-foreground mt-2">
            Be the first to host an in-person community event.
          </p>
          <Button asChild className="mt-4">
            <Link href="/e/new">Host an Event</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {upcomingEvents.map((event) => (
            <Link
              key={event.id}
              href={`/e/${event.slug}`}
              className="hover:bg-accent block rounded-lg border p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold">
                    {event.title}
                  </h2>
                  {event.venue && (
                    <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">
                        {event.venue.name} · {event.venue.city},{' '}
                        {event.venue.state}
                      </span>
                    </div>
                  )}
                  <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                    <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      {new Date(event.startsAt).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: event.timezone || 'America/New_York',
                      })}
                    </span>
                  </div>
                </div>
                <div className="text-muted-foreground flex flex-shrink-0 flex-col items-end gap-1 text-sm">
                  {event.attendeeCap && (
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span>
                        {event.attendeeCount}/{event.attendeeCap}
                      </span>
                    </div>
                  )}
                  {event.ageRestriction !== 'all_ages' && (
                    <span className="bg-muted rounded px-1.5 py-0.5 text-xs font-medium">
                      {event.ageRestriction === '18_plus' ? '18+' : '21+'}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
