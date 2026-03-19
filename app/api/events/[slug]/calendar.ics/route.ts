import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events } from '@/lib/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

function formatICalDate(date: Date, timezone?: string): string {
  // Format: YYYYMMDDTHHmmss (local) with TZID or YYYYMMDDTHHmmssZ (UTC)
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  if (timezone) {
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  }
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  // RFC 5545: fold lines at 75 octets
  const FOLD_LENGTH = 75;
  if (line.length <= FOLD_LENGTH) return line;
  let result = '';
  let pos = 0;
  while (pos < line.length) {
    if (pos === 0) {
      result += line.slice(0, FOLD_LENGTH);
      pos = FOLD_LENGTH;
    } else {
      result += '\r\n ' + line.slice(pos, pos + FOLD_LENGTH - 1);
      pos += FOLD_LENGTH - 1;
    }
  }
  return result;
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
      },
    });

    if (!event)
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    if (event.status !== 'published' && event.status !== 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Event not available' },
        { status: 404 }
      );
    }

    const now = new Date();
    const tz = event.timezone || 'America/New_York';
    const location = event.venue
      ? `${event.venue.name}\\, ${event.venue.address}\\, ${event.venue.city}\\, ${event.venue.state} ${event.venue.postalCode || ''}`.trim()
      : '';

    const description = event.description
      ? escapeICalText(stripHtml(event.description).slice(0, 1000))
      : '';

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Panamia Club//Events//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event.iCalUid}`,
      `DTSTAMP:${formatICalDate(now)}`,
      `DTSTART;TZID=${tz}:${formatICalDate(event.startsAt, tz)}`,
      ...(event.endsAt
        ? [`DTEND;TZID=${tz}:${formatICalDate(event.endsAt, tz)}`]
        : []),
      `SUMMARY:${escapeICalText(event.title)}`,
      ...(description ? [`DESCRIPTION:${description}`] : []),
      ...(location ? [`LOCATION:${location}`] : []),
      `URL:https://panamia.club/e/${event.slug}`,
      `STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];

    const icalContent = lines.map(foldLine).join('\r\n') + '\r\n';

    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}.ics"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating iCal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate calendar file' },
      { status: 500 }
    );
  }
}
