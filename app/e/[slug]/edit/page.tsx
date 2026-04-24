'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';

const EventEditor = dynamic(() => import('@/components/EventEditor'), {
  loading: () => (
    <p className="text-muted-foreground py-12 text-center">Loading editor...</p>
  ),
});
import Link from 'next/link';

interface EventData {
  slug: string;
  title: string;
  description?: string;
  venueId: string;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  visibility: string;
  attendeeCap?: number | null;
  ageRestriction: string;
  photoPolicy: string;
  dresscode: string;
  streamEligible: boolean;
  status: string;
}

export default function EditEventPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push(`/signin?callbackUrl=/e/${slug}/edit`);
    }
  }, [sessionStatus, router, slug]);

  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await fetch(`/api/events/${slug}`);
        const data = await res.json();

        if (!data.success) {
          setError(data.error || 'Event not found');
          return;
        }

        setEvent(data.data);
      } catch {
        setError('Failed to load event');
      } finally {
        setLoading(false);
      }
    }

    if (session && slug) {
      fetchEvent();
    }
  }, [session, slug]);

  if (sessionStatus === 'loading' || loading) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              You must be signed in to edit an event.
            </p>
            <Button asChild>
              <Link href={`/signin?callbackUrl=/e/${slug}/edit`}>Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">{error}</p>
            <Button asChild variant="outline">
              <Link href={`/e/${slug}`}>Back to Event</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Event Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              The event you&apos;re looking for doesn&apos;t exist or you
              don&apos;t have access to it.
            </p>
            <Button asChild variant="outline">
              <Link href="/e">Back to Events</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <EventEditor
        mode="edit"
        initialData={{
          slug: event.slug,
          title: event.title,
          description: event.description,
          venueId: event.venueId,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          timezone: event.timezone,
          visibility: event.visibility,
          attendeeCap: event.attendeeCap,
          ageRestriction: event.ageRestriction,
          photoPolicy: event.photoPolicy,
          dresscode: event.dresscode,
          streamEligible: event.streamEligible,
          status: event.status,
        }}
      />
    </main>
  );
}
