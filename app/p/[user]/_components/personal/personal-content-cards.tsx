'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Globe, Lock, Users } from 'lucide-react';
import { isUnoptimizableImageSrc } from '@/lib/image-src';
import type {
  ProfileEventSummary,
  ProfileGroupSummary,
} from '@/lib/query/social';

/* Cards for the content column.
 *
 * Both are one-per-row rather than a grid, which is the part of the feed the
 * redesign is borrowing. A grid asks you to scan; a column asks you to read.
 * These sections are short enough that reading them is the right ask, and it
 * keeps every section the same shape as the posts they sit beside.
 */

/* Event times are stored with the timezone they were scheduled in, so a show
 * at 8pm in Miami reads as 8pm to someone looking from Orlando. An unparseable
 * zone would otherwise throw inside the formatter and take the whole tab with
 * it, so a bad value falls back to the viewer's own zone rather than failing. */
function eventParts(startsAt: string, timezone: string | null) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;

  const format = (options: Intl.DateTimeFormatOptions) => {
    try {
      return date.toLocaleString('en-US', {
        ...options,
        timeZone: timezone ?? undefined,
      });
    } catch {
      return date.toLocaleString('en-US', options);
    }
  };

  return {
    month: format({ month: 'short' }).toUpperCase(),
    day: format({ day: 'numeric' }),
    weekday: format({ weekday: 'short' }),
    time: format({ hour: 'numeric', minute: '2-digit' }),
    past: date.getTime() < Date.now(),
  };
}

/* An event this pana is hosting or going to.
 *
 * The date chip leads because the first question about an event is always
 * "when", and a left-edge chip is scannable down a column in a way a date
 * buried in a line of meta is not. */
export function EventCard({ event }: { event: ProfileEventSummary }) {
  const parts = eventParts(event.startsAt, event.timezone);
  if (!parts) return null;

  const place = event.online
    ? 'Online'
    : event.venue
      ? [event.venue.name, event.venue.city].filter(Boolean).join(' · ')
      : null;

  return (
    <article
      className="profile-card p-4 data-[past=true]:opacity-65"
      data-past={parts.past ? 'true' : undefined}
    >
      <div className="flex items-start gap-4">
        <div className="border-pana-ink/12 w-14 flex-none overflow-hidden rounded-xl border-2 text-center">
          <p className="bg-pana-indigo text-pana-cream py-0.5 text-[10px] font-black tracking-widest">
            {parts.month}
          </p>
          <p className="pt-1 text-2xl leading-none font-black">{parts.day}</p>
          <p className="text-pana-ink/55 pb-1.5 text-[10px] font-bold tracking-wider uppercase">
            {parts.weekday}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="card-flag"
              data-tone={event.role === 'hosting' ? 'admin' : undefined}
            >
              {event.role === 'hosting' ? 'Hosting' : 'Going'}
            </span>
            {/* A `going` row only ever reaches the owner's own view, so the
                marker is a reminder of who can see it, shown to the one
                person who can act on that. */}
            {event.role === 'going' && (
              <span className="card-flag">
                <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                Only you
              </span>
            )}
          </div>

          <h3 className="mt-1.5 text-[15px] leading-snug font-extrabold">
            <Link href={`/e/${event.slug}`} className="hover:underline">
              {event.title}
            </Link>
          </h3>

          {(place || parts.time) && (
            <p className="text-pana-ink/70 mt-1 text-[13px] leading-snug font-medium">
              {[parts.time, place].filter(Boolean).join(' · ')}
            </p>
          )}

          {event.attendeeCount > 0 && (
            <p className="text-pana-ink/50 mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {event.attendeeCount.toLocaleString('en-US')} going
            </p>
          )}
        </div>

        {event.coverImage && (
          <div className="border-pana-ink/10 relative hidden h-18 w-24 flex-none overflow-hidden rounded-xl border-2 sm:block">
            <Image
              src={event.coverImage}
              alt={event.coverImageAlt ?? ''}
              fill
              sizes="96px"
              className="object-cover"
              unoptimized={isUnoptimizableImageSrc(event.coverImage)}
            />
          </div>
        )}
      </div>
    </article>
  );
}

/* A group, laid out as a row instead of a grid tile. The icon shrinks to a
   thumbnail because a group's picture identifies it but is not the reason you
   are reading the row — the blurb is.

   Only public groups an actor actively belongs to ever reach this component;
   the endpoint filters both, so the row carries an "Open" flag rather than a
   privacy control the viewer could read as a choice this pana made. */
export function GroupRow({ group }: { group: ProfileGroupSummary }) {
  return (
    <article className="profile-card p-4">
      <div className="flex items-start gap-4">
        <div className="border-pana-ink/10 bg-pana-butter relative h-18 w-18 flex-none overflow-hidden rounded-xl border-2">
          {group.iconUrl ? (
            <Image
              src={group.iconUrl}
              alt=""
              fill
              sizes="72px"
              className="object-cover"
              unoptimized={isUnoptimizableImageSrc(group.iconUrl)}
            />
          ) : (
            <span className="text-pana-ink flex h-full w-full items-center justify-center text-xl font-black">
              {group.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span className="card-flag">
            <Globe className="h-2.5 w-2.5" aria-hidden="true" />
            Open
          </span>

          <h3 className="mt-1.5 text-[15px] leading-snug font-extrabold">
            <Link href={`/g/${group.handle}`} className="hover:underline">
              {group.name}
            </Link>
          </h3>

          {group.summary && (
            <p className="text-pana-ink/70 mt-1 text-[13px] leading-snug font-medium">
              {group.summary}
            </p>
          )}

          <p className="text-pana-ink/50 mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {group.memberCount.toLocaleString('en-US')} members
          </p>
        </div>
      </div>
    </article>
  );
}
