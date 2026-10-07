'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Globe,
  MapPin,
  Users,
} from 'lucide-react';
import { KIND_ICON } from '@/components/kind-icon';
import type { MockEvent } from '../_data';

const EventIcon = KIND_ICON.event;

/**
 * One event on the discover page.
 *
 * This is `/mock/directory-unified`'s card with the event column of its slot
 * table filled all the way in, rather than a second card invented for events.
 * That matters more than it sounds: the directory already decided what a
 * result looks like — media, head, where, blurb, tags, when, signals, actions
 * — and an events page that draws its own card is an events page that will
 * drift from the directory the first time either is touched.
 *
 * Three things are added here that a listing has no use for and an event
 * cannot do without.
 *
 * The **price chip** sits on the media opposite the kind chip. Cost is the
 * first filter a person applies and the one most often missing until the
 * detail page, by which point they have spent a click to learn they cannot
 * afford it. Free is said as "Free", not "$0", because that is what it is.
 *
 * The **capacity line** only appears when a cap exists and is nearly met.
 * Showing "22 of 24" on every card turns a real signal into furniture; showing
 * it at four seats left is the moment it changes what somebody does.
 *
 * The **RSVP button** reuses `.dirsearch-save`'s geometry and its `data-on`
 * toggle rather than introducing a new control, so the saved/unsaved idiom a
 * reviewer already knows from listings carries over intact. It is the same
 * button, doing the thing the directory's `ACTION_LABEL` map already named
 * `rsvp` for events.
 */
export function EventCard({
  event,
  going,
  onToggleGoing,
}: {
  event: MockEvent;
  going: boolean;
  onToggleGoing: (id: string) => void;
}) {
  // Derived, never typed — the README's rule, and the reason this reads right
  // after a fixture is edited.
  const seatsLeft = event.cap === null ? null : event.cap - event.going;
  const nearlyFull = seatsLeft !== null && seatsLeft <= 4;
  const attending = event.going + (going ? 1 : 0);
  const free = event.price.toLowerCase() === 'free';

  return (
    <article className="dirsearch-card">
      <Link
        href={`/e/${event.slug}`}
        className="dirsearch-card-media"
        aria-label={`${event.title} — view`}
        tabIndex={-1}
      >
        {event.cover ? (
          <Image
            src={event.cover}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 320px"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center">
            <EventIcon className="h-8 w-8 opacity-25" aria-hidden="true" />
          </span>
        )}

        <span className="bg-pana-ink/85 text-pana-cream absolute bottom-[0.7rem] left-[0.7rem] inline-flex items-center gap-[0.3rem] rounded-full px-[0.7rem] py-[0.28rem] text-[0.6875rem] font-black tracking-[0.04em] uppercase backdrop-blur-sm">
          <EventIcon className="h-3 w-3" aria-hidden="true" />
          event
        </span>

        <span
          className={`absolute right-[0.7rem] bottom-[0.7rem] inline-flex items-center rounded-full px-[0.7rem] py-[0.28rem] text-[0.6875rem] font-black tracking-[0.04em] uppercase backdrop-blur-sm ${
            free
              ? 'bg-pana-pink text-pana-cream'
              : 'bg-pana-cream/92 text-pana-ink'
          }`}
        >
          {event.price}
        </span>
      </Link>

      <div className="dirsearch-card-body">
        <div className="dirsearch-card-head">
          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">
              <Link href={`/e/${event.slug}`}>{event.title}</Link>
            </h3>
            <p className="dirsearch-card-tagline">Hosted by {event.host}</p>
          </div>
        </div>

        {/* When comes before where on an event, which is the one place this
            card inverts the listing's order. A listing is somewhere whether or
            not you go today; an event stops existing at a particular hour, so
            the hour is what decides whether the rest of the card matters. */}
        <p className="dirsearch-card-event">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          <strong>{event.when}</strong>
        </p>

        <p className="dirsearch-card-where">
          {event.mode === 'online' ? (
            <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{event.where}</span>
          {event.mode === 'hybrid' && (
            <span className="dirsearch-card-distance">+ online</span>
          )}
        </p>

        <p className="dirsearch-card-blurb">{event.blurb}</p>

        <ul className="dirsearch-card-cats">
          {event.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            {event.faces.length > 0 && (
              <span className="dirsearch-card-avatars" aria-hidden="true">
                {event.faces.map((face) => (
                  <Image key={face} src={face} alt="" width={26} height={26} />
                ))}
              </span>
            )}
            <span className="dirsearch-card-counts">
              {attending} going
              {nearlyFull && (
                <strong className="text-pana-pink ml-1">
                  · {seatsLeft} left
                </strong>
              )}
            </span>
          </div>

          <div className="dirsearch-card-actions">
            <button
              type="button"
              className="dirsearch-save"
              data-on={going}
              aria-pressed={going}
              onClick={() => onToggleGoing(event.id)}
            >
              {going ? (
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Users className="h-4 w-4" aria-hidden="true" />
              )}
              {going ? "You're going" : 'RSVP'}
            </button>
            <Link href={`/e/${event.slug}`} className="dirsearch-view">
              View
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
