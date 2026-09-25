import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { corsHeaders } from '@/lib/federation/cors';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const event = await db.query.events.findFirst({
      where: eq(events.slug, slug),
      with: {
        venue: {
          columns: {
            name: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
          },
        },
        host: {
          columns: { federationEnabled: true },
          with: { user: { columns: { screenname: true } } },
        },
      },
    });

    if (
      !event ||
      event.status !== 'published' ||
      event.visibility !== 'public'
    ) {
      return NextResponse.json(
        { error: 'Not Found' },
        { status: 404, headers: corsHeaders('GET') }
      );
    }

    // Federated identity, not a web origin: this mints the AS2 `id` for the
    // event, which remote servers store permanently. It must track the
    // federation domain and must NOT follow the web surface at cutover.
    // See docs/DOMAINS.md.
    const baseUrl = 'https://pana.social';
    // Attribute the event to its host only if that member publishes to the
    // fediverse. Hosting a public event is a decision about the event, not
    // consent to have your own account named on servers elsewhere -- and
    // with federation off the actor URL 404s, so attributing it would also
    // hand remote servers a reference that resolves to nothing.
    const hostScreenname = event.host?.federationEnabled
      ? event.host?.user?.screenname
      : undefined;

    const as2Event = {
      '@context': ['https://www.w3.org/ns/activitystreams'],
      type: 'Event',
      id: `${baseUrl}/e/${event.slug}`,
      name: event.title,
      content: event.description || '',
      url: `${baseUrl}/e/${event.slug}`,
      startTime: event.startsAt.toISOString(),
      ...(event.endsAt ? { endTime: event.endsAt.toISOString() } : {}),
      location: event.venue
        ? {
            type: 'Place',
            name: event.venue.name,
            address: `${event.venue.address}, ${event.venue.city}, ${event.venue.state}${event.venue.postalCode ? ' ' + event.venue.postalCode : ''}`,
          }
        : undefined,
      ...(hostScreenname
        ? { attributedTo: `${baseUrl}/p/${hostScreenname}/` }
        : {}),
      published: event.createdAt.toISOString(),
      updated: event.updatedAt.toISOString(),
    };

    return new NextResponse(JSON.stringify(as2Event), {
      status: 200,
      headers: {
        ...corsHeaders('GET'),
        'Content-Type': 'application/activity+json',
        'Cache-Control': 'max-age=180',
      },
    });
  } catch (error) {
    console.error('Error serving AS2 event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders('GET') }
    );
  }
}
