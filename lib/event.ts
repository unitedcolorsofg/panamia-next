/**
 * Event helpers: slug generation, publish check, queries, iCalendar export.
 *
 * Mirrors the shape of lib/article.ts. Postgres is authoritative; the Nostr
 * (kind-31923) mirror is handled separately in lib/relay/crosspost-client.ts.
 */

import { db } from '@/lib/db';
import { events } from '@/lib/schema';
import { and, asc, desc, eq, gte } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { Event, EventStatus } from '@/lib/schema';

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

export async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = generateSlug(title);
  if (!baseSlug) return `event-${Date.now()}`;

  let slug = baseSlug;
  let counter = 1;
  while (await db.query.events.findFirst({ where: eq(events.slug, slug) })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
}

/**
 * Stable RFC 5545 UID for an event's VEVENT, so calendar apps update rather than
 * duplicate on re-import. Generated once at create time and stored on the row.
 */
export function buildIcalUid(): string {
  const host = process.env.NEXT_PUBLIC_HOST_URL ?? 'pana.social';
  let domain = 'pana.social';
  try {
    domain = new URL(host).host || domain;
  } catch {
    // host wasn't a full URL — fall back to the default domain.
  }
  return `${createId()}@${domain}`;
}

export function isPublishable(eventDoc: {
  title?: string | null;
  startsAt?: Date | null;
  status?: EventStatus;
}): { publishable: boolean; reason?: string } {
  if (!eventDoc.title?.trim()) {
    return { publishable: false, reason: 'Event must have a title' };
  }
  if (!eventDoc.startsAt) {
    return { publishable: false, reason: 'Event must have a start time' };
  }
  if (eventDoc.status === 'published') {
    return { publishable: false, reason: 'Event is already published' };
  }
  if (eventDoc.status === 'cancelled') {
    return { publishable: false, reason: 'Event is cancelled' };
  }
  return { publishable: true };
}

export async function getEventBySlug(slug: string) {
  return await db.query.events.findFirst({
    where: eq(events.slug, slug),
    with: { venue: true, host: true },
  });
}

export async function getUpcomingEvents(
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 20, offset = 0 } = options;
  const now = new Date();
  return await db.query.events.findMany({
    where: and(
      eq(events.status, 'published' as EventStatus),
      eq(events.visibility, 'public'),
      gte(events.startsAt, now)
    ),
    orderBy: [asc(events.startsAt)],
    offset,
    limit,
    with: {
      venue: { columns: { name: true, city: true, state: true, slug: true } },
    },
  });
}

export async function getEventsByHost(hostProfileId: string) {
  return await db.query.events.findMany({
    where: eq(events.hostProfileId, hostProfileId),
    orderBy: [desc(events.startsAt)],
    with: {
      venue: { columns: { name: true, city: true, state: true } },
    },
  });
}

// -----------------------------------------------------------------------------
// iCalendar (RFC 5545) export for the /api/events/[slug]/calendar.ics route.
// -----------------------------------------------------------------------------

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsDate(date: Date): string {
  // UTC, basic format: YYYYMMDDTHHMMSSZ
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

interface IcsVenue {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

export function eventToICS(
  event: Pick<
    Event,
    | 'title'
    | 'description'
    | 'startsAt'
    | 'endsAt'
    | 'icalUid'
    | 'slug'
    | 'createdAt'
    | 'updatedAt'
  >,
  venue?: IcsVenue | null
): string {
  const host = (process.env.NEXT_PUBLIC_HOST_URL ?? '').replace(/\/$/, '');
  const url = host ? `${host}/e/${event.slug}` : undefined;

  const location = venue
    ? [venue.name, venue.address, venue.city, venue.state]
        .filter(Boolean)
        .join(', ')
    : undefined;

  // Default duration of 2h when no end time was given, matching the UI hint.
  const end =
    event.endsAt ?? new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pana MIA//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.icalUid}`,
    `DTSTAMP:${icsDate(event.updatedAt ?? event.createdAt ?? new Date())}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    ...(event.description
      ? [`DESCRIPTION:${icsEscape(event.description)}`]
      : []),
    ...(location ? [`LOCATION:${icsEscape(location)}`] : []),
    ...(url ? [`URL:${icsEscape(url)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // RFC 5545 line endings are CRLF.
  return lines.join('\r\n') + '\r\n';
}
