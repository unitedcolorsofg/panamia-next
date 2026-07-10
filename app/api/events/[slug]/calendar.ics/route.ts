/**
 * iCalendar (RFC 5545) feed for a single event — the "Add to calendar" link on
 * the event page. Public for published events.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { eventToICS } from '@/lib/event';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const event = await db.query.events.findFirst({
    where: eq(events.slug, slug),
    with: {
      venue: {
        columns: { name: true, address: true, city: true, state: true },
      },
    },
  });
  if (!event || event.status !== 'published') {
    return new NextResponse('Event not found', { status: 404 });
  }

  const ics = eventToICS(event, event.venue);
  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
