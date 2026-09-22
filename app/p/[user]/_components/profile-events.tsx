'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Clock, Globe, MapPin, Ticket } from 'lucide-react';

export interface ProfileEvent {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
  /** IANA zone the event was scheduled in. */
  timezone: string;
  coverImage: string | null;
  coverImageAlt: string | null;
  online: boolean;
  venueName: string | null;
  venueCity: string | null;
}

/**
 * Format an event's date in the timezone it was scheduled in.
 *
 * Not the viewer's timezone and not the server's: a market in Miami starts at
 * 11am Miami time no matter where the person reading about it happens to be,
 * and a listing that quietly shifts an event to the previous day for a visitor
 * abroad is worse than one that is explicit. Because the zone is a stored
 * column rather than an ambient default, the server render and the client
 * render agree, so this is also hydration-safe.
 */
function formatEventDate(date: Date, timezone: string, locale: string) {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const minute = get('minute');
  const hour = get('hour');
  const dayPeriod = get('dayPeriod');

  return {
    month: get('month'),
    day: get('day'),
    weekday: get('weekday'),
    // Drop ":00" — "7pm" reads faster than "7:00 PM" and the grid is tight.
    time: `${hour}${minute === '00' ? '' : `:${minute}`}${
      dayPeriod ? ` ${dayPeriod.toLowerCase().replace(/\s/g, '')}` : ''
    }`,
  };
}

/**
 * Where to actually find this business in the next three months.
 *
 * Scoped to a quarter on purpose. An unbounded list turns into an archive
 * nobody scrolls, and for a business that mostly appears at pop-ups and
 * markets the useful question is "where can I find them soon", not "where have
 * they ever been".
 *
 * Only events this profile hosts appear. The schema has no notion of a
 * business vending at someone else's event, so claiming "hosting, vending, or
 * partnering" would be a promise the data cannot keep.
 */
export function ProfileEvents({ events }: { events: ProfileEvent[] }) {
  const { t, i18n } = useTranslation('profile');

  if (events.length === 0) return null;

  return (
    <section className="surface-butter-2 py-16 md:py-24">
      <div className="container mx-auto px-4" data-rv>
        <div className="mb-10">
          <span className="section-eyebrow">{t('events.eyebrow')}</span>
          <h2 className="bizprofile-h2 mt-4">{t('events.heading')}</h2>
          <p className="section-lede mt-5">{t('events.horizon')}</p>
        </div>

        <ul className="grid gap-5 md:grid-cols-2">
          {events.map((event) => {
            const { month, day, weekday, time } = formatEventDate(
              event.startsAt,
              event.timezone,
              i18n.language
            );
            const place = [event.venueName, event.venueCity]
              .filter(Boolean)
              .join(', ');

            return (
              <li key={event.id} className="bizprofile-card overflow-hidden">
                <Link
                  href={`/events/${event.slug}`}
                  className="group flex flex-col"
                >
                  {event.coverImage && (
                    <div className="bizprofile-eventcover h-40">
                      <Image
                        src={event.coverImage}
                        alt={event.coverImageAlt ?? ''}
                        fill
                        sizes="(min-width: 768px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  )}

                  <div className="flex gap-5 p-6">
                    <div className="bizprofile-datechip">
                      <span className="chip-month">{month}</span>
                      <span className="chip-day">{day}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl leading-tight font-extrabold group-hover:underline">
                        {event.title}
                      </h3>

                      <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold opacity-75">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        {weekday} &middot; {time}
                      </p>

                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold opacity-75">
                        {event.online ? (
                          <>
                            <Globe className="h-4 w-4" aria-hidden="true" />
                            {t('events.online')}
                          </>
                        ) : (
                          <>
                            <MapPin className="h-4 w-4" aria-hidden="true" />
                            <span className="truncate">{place}</span>
                          </>
                        )}
                      </p>

                      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold">
                        <Ticket className="h-4 w-4" aria-hidden="true" />
                        {t('events.tickets')}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * Rendered in place of the list when a claimed listing has nothing scheduled.
 *
 * Separated from the list above so an unclaimed listing — which has nobody to
 * add an event — shows nothing at all rather than an empty state addressed to
 * an owner who does not exist.
 */
export function ProfileEventsEmpty() {
  const { t } = useTranslation('profile');

  return (
    <section className="surface-butter-2 py-16 md:py-24">
      <div className="container mx-auto px-4" data-rv>
        <span className="section-eyebrow">{t('events.eyebrow')}</span>
        <h2 className="bizprofile-h2 mt-4">{t('events.heading')}</h2>
        <div className="bizprofile-card mt-8 flex flex-col items-center gap-3 px-6 py-16 text-center">
          <CalendarDays className="h-8 w-8 opacity-40" aria-hidden="true" />
          <p className="text-lg font-extrabold">{t('events.empty')}</p>
          <p className="section-lede">{t('events.emptyHint')}</p>
        </div>
      </div>
    </section>
  );
}
