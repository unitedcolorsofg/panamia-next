import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events, eventOrganizers, profiles } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ManageEventPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const event = await db.query.events.findFirst({
    where: eq(events.slug, slug),
    with: { venue: { columns: { name: true, city: true, state: true } } },
  });
  if (!event) notFound();

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
  });
  if (!profile) notFound();

  const isAdmin = session.user.isAdmin || false;
  const org = await db.query.eventOrganizers.findFirst({
    where: and(
      eq(eventOrganizers.eventId, event.id),
      eq(eventOrganizers.profileId, profile.id)
    ),
  });

  if (!org && !isAdmin) redirect(`/e/${slug}`);

  const isHost = org?.role === 'host';
  const canSeeRsvpList = org?.canSeeRsvpList || isAdmin;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/e/${slug}`}
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Back to Event
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Manage: {event.title}</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Status: <span className="font-medium capitalize">{event.status}</span> ·{' '}
        Your role:{' '}
        <span className="font-medium capitalize">
          {org?.role?.replace('_', ' ') || 'Admin'}
        </span>
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {canSeeRsvpList && (
          <Link
            href={`/e/${slug}/manage/attendees`}
            className="hover:bg-accent rounded-lg border p-4"
          >
            <p className="font-medium">Attendees</p>
            <p className="text-muted-foreground text-sm">
              View and manage RSVP list ({event.attendeeCount} going)
            </p>
          </Link>
        )}
        <Link
          href={`/e/${slug}/manage/notes`}
          className="hover:bg-accent rounded-lg border p-4"
        >
          <p className="font-medium">Notes</p>
          <p className="text-muted-foreground text-sm">
            Post updates for attendees
          </p>
        </Link>
        <Link
          href={`/e/${slug}/manage/photos`}
          className="hover:bg-accent rounded-lg border p-4"
        >
          <p className="font-medium">Photos</p>
          <p className="text-muted-foreground text-sm">
            Approve submitted photos
          </p>
        </Link>
        {(isHost || isAdmin) && (
          <Link
            href={`/e/${slug}/edit`}
            className="hover:bg-accent rounded-lg border p-4"
          >
            <p className="font-medium">Edit Event</p>
            <p className="text-muted-foreground text-sm">
              Update event details, publish, or cancel
            </p>
          </Link>
        )}
      </div>

      {event.cfStreamSrtUrl && (
        <div className="mt-6 rounded-lg border p-4">
          <p className="font-medium">Livestream Setup</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Your event has a Cloudflare Stream live input configured.
          </p>
          <div className="mt-2 space-y-1 text-sm">
            <p>
              <span className="font-medium">SRT URL:</span>{' '}
              <code className="bg-muted rounded px-1">
                {event.cfStreamSrtUrl}
              </code>
            </p>
            {event.cfStreamSrtKey && (
              <p>
                <span className="font-medium">Stream Key:</span>{' '}
                <code className="bg-muted rounded px-1">
                  {event.cfStreamSrtKey}
                </code>
              </p>
            )}
            <p>
              <span className="font-medium">Status:</span>{' '}
              <span className="capitalize">{event.streamStatus}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
