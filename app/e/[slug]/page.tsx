import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events, eventOrganizers, profiles } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { MapPin, Clock, Users, Download, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getEmbedUrl } from '@/lib/cloudflare-stream';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const event = await db.query.events.findFirst({
    where: eq(events.slug, slug),
    columns: { title: true, description: true },
  });
  if (!event) return { title: 'Event Not Found' };
  return {
    title: `${event.title} | Panamia Club`,
    description: event.description?.slice(0, 160),
  };
}

export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();

  const event = await db.query.events.findFirst({
    where: eq(events.slug, slug),
    with: {
      venue: true,
      hostProfile: { columns: { id: true, name: true } },
      organizers: {
        with: { profile: { columns: { id: true, name: true } } },
      },
    },
  });

  if (!event) notFound();

  // Access control
  const isPublic =
    event.status === 'published' && event.visibility === 'public';
  if (!isPublic && !session?.user?.id) notFound();

  // Check if caller is organizer
  let callerProfile = null;
  let isOrganizer = false;
  if (session?.user?.id) {
    callerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    });
    if (callerProfile) {
      isOrganizer = !!(await db.query.eventOrganizers.findFirst({
        where: and(
          eq(eventOrganizers.eventId, event.id),
          eq(eventOrganizers.profileId, callerProfile.id)
        ),
      }));
    }
  }

  const isAdmin = session?.user?.isAdmin || false;
  const isLive = event.streamStatus === 'live' && event.cfStreamPlaybackId;
  const hasRecording =
    event.streamStatus === 'ended' && event.cfStreamRecordingUrl;

  let embedUrl: string | null = null;
  if (isLive && event.cfStreamPlaybackId) {
    try {
      embedUrl = getEmbedUrl(event.cfStreamPlaybackId);
    } catch {
      /* no CF_STREAM_CUSTOMER_CODE */
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/e"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Back to Events
      </Link>

      {event.coverImage && (
        <img
          src={event.coverImage}
          alt={event.title}
          className="mt-4 max-h-64 w-full rounded-lg object-cover"
        />
      )}

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold">{event.title}</h1>
            {event.status === 'cancelled' && (
              <span className="bg-destructive/10 text-destructive rounded px-2 py-0.5 text-sm font-medium">
                Cancelled
              </span>
            )}
            {isLive && (
              <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-sm font-medium text-red-700">
                <Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE
              </span>
            )}
          </div>

          {event.panamiaCoOrganizer && (
            <p className="text-muted-foreground mt-1 text-sm">
              Organized with Panamia Club
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/api/events/${slug}/calendar.ics`}>
              <Download className="mr-1.5 h-4 w-4" />
              .ics
            </Link>
          </Button>
          {(isOrganizer || isAdmin) && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/e/${slug}/manage`}>Manage</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Live embed */}
      {embedUrl && (
        <div className="mt-6 aspect-video w-full overflow-hidden rounded-lg border">
          <iframe
            src={embedUrl}
            className="h-full w-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Recording */}
      {hasRecording && event.cfStreamRecordingUrl && (
        <div className="mt-6 rounded-lg border p-4">
          <p className="font-medium">Event Recording</p>
          <Button asChild className="mt-2" variant="outline">
            <a
              href={event.cfStreamRecordingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Watch Recording
            </a>
          </Button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {event.venue && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <Link
                href={`/venues/${event.venue.slug}`}
                className="font-medium hover:underline"
              >
                {event.venue.name}
              </Link>
              <p className="text-muted-foreground">
                {event.venue.address}, {event.venue.city}, {event.venue.state}
                {event.venue.postalCode ? ` ${event.venue.postalCode}` : ''}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <Clock className="text-muted-foreground h-4 w-4 flex-shrink-0" />
          <span>
            {new Date(event.startsAt).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZone: event.timezone || 'America/New_York',
            })}
            {event.endsAt &&
              ` – ${new Date(event.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: event.timezone || 'America/New_York' })}`}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Users className="text-muted-foreground h-4 w-4 flex-shrink-0" />
          <span>
            {event.attendeeCount} going
            {event.attendeeCap ? ` / ${event.attendeeCap} capacity` : ''}
          </span>
        </div>
      </div>

      {event.description && (
        <div className="prose prose-sm dark:prose-invert mt-6 max-w-none">
          <p className="whitespace-pre-wrap">{event.description}</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {event.ageRestriction !== 'all_ages' && (
          <span className="bg-muted rounded-full px-3 py-1 text-sm">
            {event.ageRestriction === '18_plus' ? '18+' : '21+'}
          </span>
        )}
        {event.dresscode !== 'none' && (
          <span className="bg-muted rounded-full px-3 py-1 text-sm">
            {event.dresscode === 'smart_casual'
              ? 'Smart Casual'
              : 'Formal Attire'}
          </span>
        )}
        {event.photoPolicy !== 'allowed' && (
          <span className="bg-muted rounded-full px-3 py-1 text-sm">
            {event.photoPolicy === 'restricted'
              ? 'Photos Restricted'
              : 'No Photos'}
          </span>
        )}
        {event.streamEligible && (
          <span className="bg-muted rounded-full px-3 py-1 text-sm">
            Livestream Eligible
          </span>
        )}
      </div>

      {session?.user?.id && event.status === 'published' && (
        <div className="mt-6 flex gap-2">
          <Button asChild>
            <Link href={`/api/events/${slug}/rsvp`}>RSVP</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/e/${slug}/photos`}>Photos</Link>
          </Button>
        </div>
      )}

      {event.organizers && event.organizers.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Organizers</h2>
          <ul className="mt-2 space-y-1">
            {event.organizers.map((org) => (
              <li key={org.id} className="text-muted-foreground text-sm">
                {org.profile?.name} — {org.role.replace('_', ' ')}
              </li>
            ))}
            {event.panamiaCoOrganizer && (
              <li className="text-muted-foreground text-sm">
                Panamia Club — Co-Organizer
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
