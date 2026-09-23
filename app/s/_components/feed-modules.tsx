'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Store } from 'lucide-react';
import { useFeaturedProfiles } from '@/lib/query/directory';
import { useUpcomingEvents, type UpcomingEvent } from '@/lib/query/events';

/* Modules injected between posts.
 *
 * The feed without these is a single column of statuses and nothing else,
 * which is why it collapses to a grey box the moment the people you follow go
 * quiet. These carry the surface on a slow day and give a new account
 * something to act on before it has followed anybody.
 *
 * Two of the mock's three modules are here. The third — "Panas you might
 * know" — is not, because nothing in the product recommends accounts yet and
 * the module is worthless without that; a suggestion list needs a reason
 * beside each name, and there is no query that produces one.
 *
 * Both modules render nothing at all when they have no rows. A module that
 * degrades to a heading above an empty strip is worse than an absent one,
 * because it reads as breakage rather than as quiet.
 *
 * Images are plain <img> rather than next/image on purpose: these are remote
 * CDN URLs and next.config.js declares no remotePatterns, so the optimizer
 * rejects them at runtime. This matches the homepage and the directory card.
 */

/* Formats an event's start in its own timezone, not the reader's.
 *
 * Near events get a weekday — "Thu, 7:00 PM" is how you'd say it out loud, and
 * the date would be noise. Anything beyond a week gets the month and day,
 * because a weekday alone is actively misleading at that distance: an event
 * eight months out would otherwise read as this coming Saturday. The mock's
 * fixtures were all within the week, so its format had no reason to handle
 * this; the real table is seeded months ahead. */
function formatEventWhen(startsAt: string, timezone: string): string | null {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;

  const daysOut = (date.getTime() - Date.now()) / 86_400_000;
  const nearby = daysOut < 6;

  const options: Intl.DateTimeFormatOptions = nearby
    ? { weekday: 'short', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };

  try {
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: timezone,
    }).format(date);
  } catch {
    /* An invalid IANA zone should not take the card down with it. */
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
}

/** "Little Haiti, FL" from whichever venue parts actually came back. */
function formatEventWhere(event: UpcomingEvent): string | null {
  const venue = event.venue;
  if (!venue) return null;
  const parts = [venue.name, venue.city].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** What is happening next, with a real RSVP count on each card. */
export function EventsModule() {
  const { data } = useUpcomingEvents(4);
  const events = data?.data?.events ?? [];

  if (events.length === 0) return null;

  return (
    <section className="feed-module" aria-labelledby="feed-module-events">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="feed-module-events" className="feed-module-title">
            Happening soon
          </h2>
          <p className="text-pana-ink/60 mt-0.5 text-[13px] font-medium">
            Markets, workshops, and dinners hosted by Panas.
          </p>
        </div>
        <Link
          href="/e"
          className="text-pana-indigo hidden flex-none text-[12px] font-extrabold tracking-wider uppercase sm:block"
        >
          See all
        </Link>
      </div>

      <div className="feed-strip">
        {events.map((event) => {
          const when = formatEventWhen(event.startsAt, event.timezone);
          const where = formatEventWhere(event);

          return (
            <Link
              key={event.id}
              href={`/e/${event.slug}`}
              className="profile-card block overflow-hidden"
            >
              <div className="media-frame aspect-[16/9] rounded-none">
                <img
                  src={event.coverImage || '/img/bg_coconut_blue.jpg'}
                  alt={event.coverImageAlt || ''}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="p-3.5">
                {when && (
                  <p className="text-pana-burnt text-[11px] font-extrabold tracking-widest uppercase">
                    {when}
                  </p>
                )}
                <h3 className="mt-1 text-[15px] leading-tight font-extrabold">
                  {event.title}
                </h3>
                {where && (
                  <p className="text-pana-ink/60 mt-1 inline-flex items-center gap-1 text-[12px] font-bold">
                    <MapPin className="h-3 w-3 flex-none" aria-hidden="true" />
                    {where}
                  </p>
                )}
                {/* Only shown once somebody is actually going. "0 Panas going"
                    on a new event reads as a failure rather than as a start. */}
                {event.attendeeCount > 0 && (
                  <p className="text-pana-ink/45 mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold">
                    <CalendarDays
                      className="h-3.5 w-3.5 flex-none"
                      aria-hidden="true"
                    />
                    {event.attendeeCount}{' '}
                    {event.attendeeCount === 1 ? 'Pana' : 'Panas'} going
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* The one module that reaches across to the other half of the product. Pana
   Mia is a directory and a social network; a feed that never mentions a
   business is leaving the connection between them on the table. */
export function DirectoryModule() {
  /* One card, because this sits inline in a timeline rather than in a grid.
     The endpoint rotates its sample every five minutes, so this is a different
     business through the day rather than the same one pinned to the feed. */
  const { data } = useFeaturedProfiles(1);
  const spotlight = data?.data?.[0];

  /* The mock shows category tags here. /api/directory/featured does not select
     them, and inventing them is exactly the kind of decoration that makes a
     feed untrustworthy, so the row is absent rather than filled. */
  if (!spotlight || !spotlight.screenname) return null;

  return (
    <section className="feed-module" aria-labelledby="feed-module-directory">
      <span id="feed-module-directory" className="section-eyebrow text-[11px]">
        From the directory
      </span>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="media-frame aspect-[4/3] w-full flex-none sm:w-44">
          <img
            src={spotlight.primaryImageCdn || '/img/bg_coconut_blue.jpg'}
            alt={spotlight.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="feed-module-title">{spotlight.name}</h2>
          {spotlight.fiveWords && (
            <p className="text-pana-indigo mt-1 text-[12px] font-extrabold tracking-wide uppercase">
              {spotlight.fiveWords}
            </p>
          )}
          {spotlight.addressLocality && (
            <p className="text-pana-ink/60 mt-1.5 inline-flex items-center gap-1 text-[13px] font-bold">
              <Store className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              {spotlight.addressLocality}
            </p>
          )}

          <Link
            href={`/p/${spotlight.screenname}`}
            className="link-arrow text-pana-indigo mt-3.5 inline-flex text-[13px]"
          >
            View listing
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
