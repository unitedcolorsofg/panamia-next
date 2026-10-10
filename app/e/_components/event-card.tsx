'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Globe,
  MapPin,
  Sparkles,
  Tag,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { KIND_ICON } from '@/components/kind-icon';
import {
  seatsLeft as seatsLeftOf,
  type DiscoveryEvent,
  type Reason,
} from '@/lib/events/lanes';

const EventIcon = KIND_ICON.event;

/**
 * One event on the discover page.
 *
 * This is the directory's result card with the event column filled in, rather
 * than a second card invented for events. That matters more than it sounds:
 * the directory already decided what a result looks like — media, head, where,
 * blurb, tags, when, signals, actions — and an events page that draws its own
 * card is an events page that will drift from the directory the first time
 * either is touched.
 *
 * Two things are added that a listing has no use for and an event cannot do
 * without, and one that no listing should ever need.
 *
 * The **capacity line** only appears when a cap exists and is nearly met.
 * Showing "22 of 24" on every card turns a real signal into furniture; showing
 * it at four seats left is the moment it changes what somebody does. It is
 * never dressed as a reason — "three seats left" is a reason to hurry, never a
 * reason the event suits you, and conflating the two is how urgency ends up
 * doing the work relevance should.
 *
 * The **reason line** is the one that only exists here. A card on a search
 * results page needs no justification — the viewer typed the query, so they
 * already hold it. A card the page chose on the viewer's behalf owes them the
 * cause, in specifics they can check, which is why `Reason` carries names and
 * tags rather than a score. Paired with "Not for me" it makes the page
 * arguable: the viewer can see the inference and reject it. That loop is the
 * whole difference between a recommendation and a thing that merely appeared.
 *
 * There is no price chip, and that is a finding rather than an oversight.
 * `events` has no price or ticket column — `rentalModel` and `venues.isFree`
 * are venue-side, describing what a host pays for a room rather than what a
 * guest pays at the door. A "Free" chip would be design resting on a column
 * nobody has agreed to add.
 */
export function EventCard({
  event,
  reason,
  onDismiss,
  compact = false,
}: {
  event: DiscoveryEvent;
  /** Why the page chose this. Absent on the calendar tab, where the viewer
   *  chose it themselves and a reason would be noise. */
  reason?: Reason;
  onDismiss?: (event: DiscoveryEvent, reason: Reason) => void;
  /** Rail mode. Drops the blurb and trims the tag row so the card fits a
   *  21rem column without becoming a tower.
   *
   *  A variant rather than a second component, deliberately: the whole
   *  argument for this file is that an events page which draws its own card
   *  drifts from the directory the first time either is touched, and that
   *  applies just as much to a card drawn for a rail. What is dropped is only
   *  ever prose — when, where, who and the signals all survive, because those
   *  are the parts somebody decides on. */
  compact?: boolean;
}) {
  const seatsLeft = seatsLeftOf(event);
  const nearlyFull = seatsLeft !== null && seatsLeft <= 4;
  const panasReason = event.reasons.find((r) => r.kind === 'panas-going');
  const faces = (panasReason?.panas ?? []).filter(
    (pana) => pana.avatar !== null
  );

  return (
    <article
      className={
        compact ? 'dirsearch-card dirsearch-card--compact' : 'dirsearch-card'
      }
    >
      <Link
        href={`/e/${event.slug}`}
        className="dirsearch-card-media"
        aria-label={`${event.title} — view`}
        tabIndex={-1}
      >
        {event.cover ? (
          <Image
            src={event.cover}
            alt={event.coverAlt ?? ''}
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
      </Link>

      <div className="dirsearch-card-body">
        {reason && <ReasonLine reason={reason} />}

        <div className="dirsearch-card-head">
          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">
              <Link href={`/e/${event.slug}`}>{event.title}</Link>
            </h3>
            <p className="dirsearch-card-tagline">
              Hosted by {event.host.name}
            </p>
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

        {!compact && event.blurb && (
          <p className="dirsearch-card-blurb">{event.blurb}</p>
        )}

        {event.tags.length > 0 && (
          <ul className="dirsearch-card-cats">
            {(compact ? event.tags.slice(0, 2) : event.tags).map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            {faces.length > 0 && (
              <span className="dirsearch-card-avatars" aria-hidden="true">
                {faces.map((pana) => (
                  <Image
                    key={pana.id}
                    src={pana.avatar as string}
                    alt=""
                    width={26}
                    height={26}
                  />
                ))}
              </span>
            )}
            <span className="dirsearch-card-counts">
              {event.going} going
              {nearlyFull && (
                <strong className="text-pana-pink ml-1">
                  · {seatsLeft} left
                </strong>
              )}
            </span>
          </div>

          <div className="dirsearch-card-actions">
            {reason && onDismiss && (
              <button
                type="button"
                className="text-pana-ink/55 hover:text-pana-ink inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.8125rem] font-bold underline-offset-4 hover:underline"
                onClick={() => onDismiss(event, reason)}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Not for me
              </button>
            )}
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

/** "Bee, Claribel and Gabriel" — and past three, a count, because a reason
 *  that runs onto two lines stops being read. */
export function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

/**
 * The cause, said in the viewer's words.
 *
 * Every branch names a specific thing — a host, people, a past event — and
 * none of them can be written without the data that justifies it, because the
 * `Reason` union carries that data in its variant. There is deliberately no
 * fallback branch reading "recommended for you": if nothing here can be said,
 * the event belongs in the bottom section, not in a lane with a vague label.
 */
function ReasonLine({ reason }: { reason: Reason }) {
  const { icon: Icon, text } = describeReason(reason);
  return (
    <p className="text-pana-ink/70 mb-1 inline-flex items-center gap-1.5 text-[0.8125rem] leading-snug font-bold">
      <Icon
        className="text-pana-pink h-3.5 w-3.5 shrink-0"
        aria-hidden="true"
      />
      {text}
    </p>
  );
}

function describeReason(reason: Reason) {
  switch (reason.kind) {
    case 'follow-host':
      return { icon: UserCheck, text: `You follow ${reason.host}` };
    case 'panas-going': {
      const names = reason.panas.map((p) => p.name);
      return {
        icon: Users,
        text: `${nameList(names)} ${names.length === 1 ? 'is' : 'are'} going`,
      };
    }
    case 'tag-match':
      return {
        icon: Tag,
        text: `${nameList(reason.tags)} — like the ${reason.from} you went to`,
      };
    case 'new-host':
      return {
        icon: Sparkles,
        text:
          reason.pastEvents === 0
            ? `${reason.host}'s first event`
            : `Only ${reason.host}'s second event`,
      };
    case 'popular':
      return { icon: TrendingUp, text: `${reason.going} people going` };
  }
}
