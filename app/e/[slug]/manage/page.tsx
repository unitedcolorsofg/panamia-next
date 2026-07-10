import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { events, profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Users, Eye } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ManageEventPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/e/${slug}/manage`);
  }

  const [event, profile] = await Promise.all([
    db.query.events.findFirst({
      where: eq(events.slug, slug),
      with: { venue: { columns: { name: true, city: true } } },
    }),
    db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
      columns: { id: true },
    }),
  ]);
  if (!event) notFound();
  if (!profile || profile.id !== event.hostProfileId) notFound();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {event.status}
            </Badge>
            {event.nostrEventId && (
              <span className="text-xs text-gray-400">· on Nostr</span>
            )}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/e/${event.slug}`}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Attendees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-gray-500">
              {event.attendeeCount} confirmed going.
            </p>
            <Button asChild size="sm">
              <Link href={`/e/${event.slug}/manage/attendees`}>
                View roster
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pencil className="h-4 w-4" />
              Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-gray-500">
              Edit details{event.status !== 'published' ? ' and publish' : ''}.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={`/e/${event.slug}/edit`}>Edit event</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder (v2): event photos and organizer notes management. See
          docs/EVENTS-ROADMAP.md — event_photos / event_notes tables and the
          /e/[slug]/photos + manage/notes routes are deferred. */}
    </main>
  );
}
