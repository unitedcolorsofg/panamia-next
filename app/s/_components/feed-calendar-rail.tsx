'use client';

import Link from 'next/link';
import { CalendarDays, Check, Lock, Users } from 'lucide-react';
import { useMyCalendar, type CalendarEntry } from '@/lib/query/social';
import { formatTime, relativeDayLabel } from '@/lib/events/format';

/* The rail's calendar module.
 *
 * Replaces the "Events & RSVPs" reserved slot, which promised "a real going
 * and interested count" -- half of which was wrong before it was built. The
 * enum is going | maybe | not_going; there is no interested. The count shown
 * here is events.attendee_count, which the RSVP route maintains and which
 * counts only 'going', so "N going" is literally what it says.
 *
 * Only the committed half appears in the rail. Suggestions need the room to
 * justify themselves and a decision to act on, and neither fits in a 19rem
 * column beside a feed -- they live on /s/calendar.
 *
 * Distinct from EventsModule in the timeline, which is "Happening soon": that
 * is public discovery and shows events whether or not they have anything to do
 * with you. This is the opposite question -- what did I already say yes to.
 */

const MAX_ROWS = 3;

function Row({ entry }: { entry: CalendarEntry }) {
  const startsAt = new Date(entry.startsAt);
  const day = relativeDayLabel(startsAt, entry.timezone);
  const isToday = day === 'Today';

  return (
    <li>
      <Link
        href={`/e/${entry.slug}`}
        className="hover:bg-pana-butter/30 -mx-2 flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors"
      >
        <span className="w-[62px] flex-none pt-0.5">
          <span
            className={`block text-[11px] leading-tight font-black tracking-wide uppercase ${
              isToday ? 'text-pana-burnt' : 'text-pana-ink/45'
            }`}
          >
            {day}
          </span>
          <span className="text-pana-ink/70 block text-[12px] leading-tight font-bold">
            {formatTime(startsAt, entry.timezone)}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1">
            <span className="truncate text-[13.5px] leading-tight font-extrabold">
              {entry.title}
            </span>
            {/* There is no private event -- the enum is public | unlisted --
                so this says unlisted and means it. */}
            {entry.visibility === 'unlisted' ? (
              <Lock
                className="text-pana-ink/40 h-3 w-3 flex-none"
                aria-label="Unlisted"
              />
            ) : null}
          </span>
          <span className="text-pana-ink/50 mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] font-bold">
            <span className="truncate">{entry.hostName}</span>
            {entry.attendeeCount > 0 ? (
              <span className="inline-flex flex-none items-center gap-1">
                <Users className="h-3 w-3" aria-hidden="true" />
                {entry.attendeeCount}
              </span>
            ) : null}
          </span>
        </span>

        {/* Hosting is not an RSVP and must not be dressed as one -- an
            organiser never clicked "going" on their own event. */}
        <span className="flex-none pt-0.5">
          {entry.reason === 'hosting' ? (
            <span className="bg-pana-indigo/10 text-pana-indigo rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide uppercase">
              Hosting
            </span>
          ) : entry.rsvp === 'going' ? (
            <Check
              className="text-pana-indigo h-3.5 w-3.5"
              aria-label="Going"
            />
          ) : (
            <span className="text-pana-ink/45 text-[10px] font-black tracking-wide uppercase">
              Maybe
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function FeedCalendarRail() {
  const { data, isLoading } = useMyCalendar();

  if (isLoading) {
    return (
      <section aria-labelledby="rail-calendar">
        <h2 id="rail-calendar" className="rail-heading">
          Coming up
        </h2>
        <div className="mt-2.5 animate-pulse space-y-2" aria-hidden="true">
          <div className="bg-pana-ink/10 h-10 rounded-xl" />
          <div className="bg-pana-ink/10 h-10 rounded-xl" />
        </div>
      </section>
    );
  }

  const committed = data?.committed ?? [];
  const suggestedCount = data?.suggested.length ?? 0;

  /* An empty calendar with suggestions behind it is worth a door; an empty
     calendar with nothing behind it is not, so the module disappears rather
     than occupying rail space to say "nothing". */
  if (committed.length === 0 && suggestedCount === 0) return null;

  const rows = committed.slice(0, MAX_ROWS);
  const undecided = committed.filter((entry) => entry.rsvp === 'maybe').length;

  return (
    <section aria-labelledby="rail-calendar">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="rail-calendar" className="rail-heading">
          Coming up
        </h2>
        <Link
          href="/s/calendar"
          className="text-pana-indigo flex-none text-[11px] font-extrabold tracking-wider uppercase"
        >
          Calendar
        </Link>
      </div>

      {committed.length > 0 ? (
        <>
          <ul className="mt-1.5">
            {rows.map((entry) => (
              <Row key={entry.id} entry={entry} />
            ))}
          </ul>

          {/* The one line worth spending rail space on: a maybe is the only
              entry still waiting on the reader to do something. */}
          {undecided > 0 ? (
            <Link
              href="/s/calendar"
              className="text-pana-ink/55 hover:text-pana-ink mt-1.5 block text-[12px] font-bold"
            >
              You said maybe to {undecided}{' '}
              {undecided === 1 ? 'event' : 'events'}
            </Link>
          ) : null}
        </>
      ) : (
        <Link
          href="/s/calendar"
          className="reserved-slot mt-2.5 block p-3.5 text-left"
        >
          <p className="reserved-slot-title inline-flex items-center gap-1.5 text-[14px]">
            <CalendarDays
              className="text-pana-indigo h-3.5 w-3.5"
              aria-hidden="true"
            />
            Nothing on yet
          </p>
          <p className="text-pana-ink/65 text-[12px] leading-snug font-medium">
            {suggestedCount} {suggestedCount === 1 ? 'event is' : 'events are'}{' '}
            coming up in your groups and from Panas you follow.
          </p>
        </Link>
      )}
    </section>
  );
}
