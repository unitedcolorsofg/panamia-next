import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EventCard from '@/components/events/EventCard';
import { getUpcomingEvents } from '@/lib/event';

export const metadata = {
  title: 'Events | Pana MIA',
  description:
    'Discover in-person and online community events across the Pana MIA network.',
};

export default async function EventsPage() {
  const upcoming = await getUpcomingEvents({ limit: 24 });

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Community Events</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            In-person and online events from the Pana MIA community
          </p>
        </div>
        <Button asChild>
          <Link href="/e/new">
            <CalendarDays className="mr-2 h-4 w-4" />
            Host an Event
          </Link>
        </Button>
      </div>

      {upcoming.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <CalendarDays className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h2 className="text-xl font-semibold">No upcoming events</h2>
          <p className="mt-2 text-gray-500">
            Be the first to host a community event.
          </p>
          <Button asChild className="mt-4">
            <Link href="/e/new">Host an Event</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((event) => (
            <EventCard
              key={event.id}
              slug={event.slug}
              title={event.title}
              description={event.description}
              coverImage={event.coverImage}
              coverImageAlt={event.coverImageAlt}
              startsAt={event.startsAt.toISOString()}
              timezone={event.timezone}
              mode={event.mode}
              attendeeCount={event.attendeeCount}
              attendeeCap={event.attendeeCap}
              venue={event.venue}
            />
          ))}
        </div>
      )}
    </main>
  );
}
