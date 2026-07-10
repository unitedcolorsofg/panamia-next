'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EventForm, {
  type EventFormInitial,
} from '@/components/events/EventForm';
import { Loader2 } from 'lucide-react';

interface EventData extends EventFormInitial {
  slug: string;
  status: string;
  nostrEventId?: string | null;
}

export default function EditEventPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push(`/signin?callbackUrl=/e/${slug}/edit`);
    }
  }, [sessionStatus, router, slug]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events/${slug}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Not found');
        const e = data.data;
        setEvent({
          slug: e.slug,
          status: e.status,
          title: e.title,
          description: e.description,
          coverImage: e.coverImage,
          coverImageAlt: e.coverImageAlt,
          venueId: e.venueId,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          timezone: e.timezone,
          mode: e.mode,
          attendeeCap: e.attendeeCap,
          tags: e.tags,
          visibility: e.visibility,
          nostrEventId: e.nostrEventId,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load event');
      } finally {
        setLoading(false);
      }
    }
    if (slug) load();
  }, [slug]);

  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${slug}/publish`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Publish failed');
      router.push(`/e/${slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }

  if (sessionStatus === 'loading' || loading) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error && !event) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-red-600">{error}</p>
            <Button asChild variant="outline">
              <Link href="/e">Back to Events</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Edit Event</CardTitle>
          {event?.status !== 'published' && (
            <Button onClick={publish} disabled={publishing}>
              {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          {event && <EventForm editSlug={slug} initial={event} />}
        </CardContent>
      </Card>
    </main>
  );
}
