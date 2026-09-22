import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Clock, MapPin, Ticket } from 'lucide-react';
import {
  EVENT_ROLE_LABEL,
  eventDate,
  formatEventDate,
  type BusinessProfile,
} from '../_data';

interface ProfileEventsProps {
  profile: BusinessProfile;
}

/**
 * Where to actually find this business in the next three months.
 *
 * Scoped to a quarter on purpose. An unbounded list turns into an archive
 * nobody scrolls, and for a business that mostly appears at pop-ups and
 * markets the useful question is "where can I find them soon", not "where
 * have they ever been".
 *
 * The role pill matters more than it looks: "hosting" and "vendor" are very
 * different promises about whether the business will be there all night, and
 * a visitor planning around a market needs to know which one they are reading.
 */
export function ProfileEvents({ profile }: ProfileEventsProps) {
  const events = profile.events;

  return (
    <section className="surface-cream py-16 md:py-24">
      <div className="container mx-auto px-4" data-rv>
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="section-eyebrow">Next 3 months</span>
            <h2 className="bizprofile-h2 mt-4">Catch them out</h2>
            <p className="section-lede mt-5">
              Every event {profile.name} is hosting, vending, or partnering on
              between now and three months from today.
            </p>
          </div>
          <Link href="#" className="link-arrow shrink-0">
            All events
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="bizprofile-card flex flex-col items-center gap-3 px-6 py-16 text-center">
            <CalendarDays className="h-8 w-8 opacity-40" aria-hidden="true" />
            <p className="text-lg font-extrabold">
              Nothing on the calendar yet
            </p>
            <p className="section-lede">
              Save {profile.name} and we will let you know the moment they add
              something.
            </p>
          </div>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2">
            {events.map((event) => {
              const { month, day, weekday } = formatEventDate(
                eventDate(event.inDays)
              );

              return (
                <li key={event.id} className="bizprofile-card overflow-hidden">
                  <Link href={event.href} className="group flex flex-col">
                    <div className="bizprofile-eventcover h-40">
                      <Image
                        src={event.coverImage}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 50vw, 100vw"
                        className="object-cover"
                        aria-hidden="true"
                      />
                      <span className="bizprofile-rolepill absolute top-4 left-4">
                        {EVENT_ROLE_LABEL[event.role]}
                      </span>
                    </div>

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
                          {weekday} · {event.startTime}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold opacity-75">
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          <span className="truncate">
                            {event.venue}, {event.city}
                          </span>
                        </p>

                        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold">
                          <Ticket className="h-4 w-4" aria-hidden="true" />
                          {event.ticketHref ? 'Get tickets' : 'Free · RSVP'}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
