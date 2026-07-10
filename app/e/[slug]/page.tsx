import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { events, eventAttendees, profiles } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import RsvpForm from '@/components/events/RsvpForm';
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Globe,
  Users,
  Download,
  Settings,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rsvp?: string }>;
}

async function getEvent(slug: string) {
  return db.query.events.findFirst({
    where: eq(events.slug, slug),
    with: {
      venue: true,
      host: { columns: { id: true, name: true, userId: true } },
    },
  });
}

const RSVP_BANNERS: Record<string, { text: string; tone: 'ok' | 'warn' }> = {
  confirmed: { text: 'Your RSVP is confirmed. See you there!', tone: 'ok' },
  expired: {
    text: 'That confirmation link expired. Please RSVP again.',
    tone: 'warn',
  },
  invalid: { text: 'That confirmation link is invalid.', tone: 'warn' },
  error: { text: 'Something went wrong confirming your RSVP.', tone: 'warn' },
};

export default async function EventPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { rsvp } = await searchParams;
  const event = await getEvent(slug);
  if (!event) notFound();

  // Only the host can view a draft before it's published. (Unlisted events are
  // reachable by direct link once published — not access-gated; see roadmap.)
  const session = await auth();
  const viewerProfile = session?.user?.id
    ? await db.query.profiles.findFirst({
        where: eq(profiles.userId, session.user.id),
        columns: { id: true },
      })
    : null;
  const isHost = !!viewerProfile && viewerProfile.id === event.hostProfileId;
  if (event.status !== 'published' && !isHost) notFound();

  // The viewer's existing RSVP, if any (logged-in only).
  let myStatus: 'going' | 'maybe' | 'not_going' | null = null;
  if (viewerProfile) {
    const mine = await db.query.eventAttendees.findFirst({
      where: and(
        eq(eventAttendees.eventId, event.id),
        eq(eventAttendees.profileId, viewerProfile.id)
      ),
      columns: { status: true },
    });
    myStatus = mine?.status ?? null;
  }

  const when = event.startsAt.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: event.timezone || undefined,
  });

  const caps = [event.attendeeCap, event.venue?.fireCapacity].filter(
    (c): c is number => typeof c === 'number' && c > 0
  );
  const hardCap = caps.length ? Math.min(...caps) : null;
  const full = hardCap !== null && event.attendeeCount >= hardCap;

  const banner = rsvp ? RSVP_BANNERS[rsvp] : null;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/e"
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Events
      </Link>

      {banner && (
        <div
          className={
            banner.tone === 'ok'
              ? 'mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300'
              : 'mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
          }
        >
          {banner.text}
        </div>
      )}

      {event.status !== 'published' && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          This event is a <strong>{event.status}</strong> — only you can see it
          until it&apos;s published.
        </div>
      )}

      {event.coverImage && (
        <div className="relative mb-8 aspect-video overflow-hidden rounded-lg">
          <Image
            src={event.coverImage}
            alt={event.coverImageAlt || event.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="capitalize">
          {event.mode}
        </Badge>
        {event.tags?.map((tag) => (
          <Badge key={tag} variant="outline">
            #{tag}
          </Badge>
        ))}
        {event.nostrEventId && (
          <span
            className="text-xs text-gray-400"
            title={`Nostr event ${event.nostrEventId}`}
          >
            · on Nostr
          </span>
        )}
      </div>

      <h1 className="mb-4 text-3xl font-bold md:text-4xl">{event.title}</h1>

      <div className="mb-6 space-y-2 text-gray-700 dark:text-gray-300">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 flex-shrink-0 text-gray-400" />
          <span>{when}</span>
        </div>
        {event.mode === 'online' ? (
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 flex-shrink-0 text-gray-400" />
            <span>Online event</span>
          </div>
        ) : (
          event.venue && (
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 flex-shrink-0 text-gray-400" />
              <span>
                {event.venue.name} · {event.venue.address}, {event.venue.city},{' '}
                {event.venue.state}
              </span>
            </div>
          )
        )}
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 flex-shrink-0 text-gray-400" />
          <span>
            {event.attendeeCount} going
            {hardCap ? ` · ${hardCap} capacity` : ''}
          </span>
        </div>
        {event.host?.name && (
          <p className="text-sm text-gray-500">Hosted by {event.host.name}</p>
        )}
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <Button asChild variant="outline" size="sm">
          <a href={`/api/events/${event.slug}/calendar.ics`}>
            <Download className="mr-2 h-4 w-4" />
            Add to calendar
          </a>
        </Button>
        {isHost && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/e/${event.slug}/manage`}>
              <Settings className="mr-2 h-4 w-4" />
              Manage
            </Link>
          </Button>
        )}
      </div>

      {event.description && (
        <div className="prose prose-lg dark:prose-invert mb-10 max-w-none whitespace-pre-wrap">
          {event.description}
        </div>
      )}

      {event.status === 'published' && (
        <section className="rounded-lg border p-6">
          <h2 className="mb-4 text-xl font-semibold">RSVP</h2>
          <RsvpForm
            slug={event.slug}
            capacity={hardCap}
            goingCount={event.attendeeCount}
            initialStatus={myStatus}
            full={full}
          />
        </section>
      )}
    </main>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: 'Event Not Found' };
  return {
    title: `${event.title} | Pana MIA Events`,
    description: event.description?.slice(0, 200) ?? undefined,
    openGraph: {
      title: event.title,
      description: event.description?.slice(0, 200) ?? undefined,
      type: 'website',
      images: event.coverImage ? [event.coverImage] : [],
    },
  };
}
