import { CalendarDays, Check, Globe, Lock, MapPin, Users } from 'lucide-react';
import {
  calendarByDay,
  calendarCommitted,
  calendarSuggested,
  type CalendarHostKind,
  type MockCalendarEvent,
} from '../_data/mock-feed';

/* The full calendar, reached from the rail widget. Stands in for /s/calendar.
 *
 * The page answers one question the rest of the site cannot: "what am I
 * actually doing". Today that answer is split three ways — a group's events
 * are on the group page, a pana's are on their profile, a directory listing's
 * are on /e — and none of those surfaces knows what you said yes to.
 *
 * It is not a replacement for /e. /e is the public explore page: everything
 * happening, whether or not it has anything to do with you, and it is the one
 * events surface that is indexed. This is the opposite — personal, signed-in,
 * and noindex by definition, because half of it is derived from who you follow.
 *
 * The structural decision here is the split between committed and suggested.
 * They are never interleaved. Merging them would make the page unusable for
 * the thing it exists for, which is finding out what you have promised.
 */

const HOST_LABEL: Record<CalendarHostKind, string> = {
  group: 'Group',
  pana: 'Pana',
  directory: 'Directory',
};

/* A host kind is worth a colour because it changes what the event is. The
   directory is the other half of Pana Mia, so an event from a listing is a
   business opening its doors, not a friend inviting you over. */
const HOST_TONE: Record<CalendarHostKind, string> = {
  group: 'bg-pana-indigo/10 text-pana-indigo',
  pana: 'bg-pana-burnt/10 text-pana-burnt',
  directory: 'bg-pana-ink/8 text-pana-ink/70',
};

function HostLine({ event }: { event: MockCalendarEvent }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={`rounded-full px-2 py-0.5 text-[10.5px] font-black tracking-wide uppercase ${HOST_TONE[event.host.kind]}`}
      >
        {HOST_LABEL[event.host.kind]}
      </span>
      <span className="text-pana-ink/70 text-[13px] font-bold">
        {event.host.name}
      </span>
      {/* An online event has no venue_id, so there is nothing to put here and
          the bullet that would separate them must not render either. */}
      {event.online ? (
        <span className="text-pana-ink/50 inline-flex items-center gap-1 text-[13px] font-bold">
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          Online
        </span>
      ) : event.where ? (
        <span className="text-pana-ink/50 inline-flex items-center gap-1 text-[13px] font-bold">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {event.where}
        </span>
      ) : null}
    </div>
  );
}

function AttendeeCount({ count }: { count: number }) {
  return (
    <span className="text-pana-ink/50 inline-flex items-center gap-1 text-[12.5px] font-bold">
      <Users className="h-3.5 w-3.5" aria-hidden="true" />
      {count} going
    </span>
  );
}

export function FeedCalendar() {
  const days = calendarByDay();
  const suggested = calendarSuggested();
  const committed = calendarCommitted();
  const goingCount = committed.filter((event) => event.rsvp === 'going').length;
  const maybeCount = committed.length - goingCount;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-[26px] leading-tight font-black">Your calendar</h1>
        {/* "4 events you said yes to" would be a lie about the maybe, and the
            maybe is the one you most need to be reminded of. */}
        <p className="text-pana-ink/60 mt-1 text-[14.5px] font-bold">
          {goingCount} events you&rsquo;re going to
          {maybeCount > 0
            ? ` and ${maybeCount} you haven\u2019t decided on`
            : ''}
          , across your groups, your Panas, and the directory.
        </p>
      </header>

      <section aria-labelledby="calendar-going" className="space-y-3">
        <h2 id="calendar-going" className="rail-heading">
          You&rsquo;re going
        </h2>

        {days.map((day) => (
          <div key={day.dateNum} className="profile-card overflow-hidden">
            <div className="border-pana-ink/8 bg-pana-butter/30 flex items-baseline gap-2 border-b px-4 py-2.5">
              <span className="text-[14px] font-black">{day.dayLabel}</span>
              <span className="text-pana-ink/45 text-[12.5px] font-bold">
                {day.dateLabel}
              </span>
              {/* Two things in one day is the case a list of cards hides and a
                  calendar has to surface. */}
              {day.events.length > 1 ? (
                <span className="text-pana-burnt ml-auto text-[12px] font-black">
                  {day.events.length} events
                </span>
              ) : null}
            </div>

            <ul className="divide-pana-ink/8 divide-y">
              {day.events.map((event) => (
                <li
                  key={event.id}
                  className="flex items-start gap-3.5 px-4 py-3.5"
                >
                  <span className="w-[72px] flex-none pt-0.5 text-[13.5px] font-black">
                    {event.time}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[15.5px] leading-tight font-extrabold">
                        {event.title}
                      </span>
                      {/* There is no private event — the enum is public |
                          unlisted — so this says unlisted and means it. */}
                      {event.visibility === 'unlisted' ? (
                        <span className="bg-pana-ink/8 text-pana-ink/60 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-black tracking-wide uppercase">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          Unlisted
                        </span>
                      ) : null}
                    </div>
                    <HostLine event={event} />
                    <div className="mt-2 flex items-center gap-3">
                      <AttendeeCount count={event.attendeeCount} />
                    </div>
                  </div>

                  <span
                    className={`inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-black ${
                      event.rsvp === 'going'
                        ? 'bg-pana-indigo text-white'
                        : 'border-pana-ink/15 text-pana-ink/60 border-2'
                    }`}
                  >
                    {event.rsvp === 'going' ? (
                      <>
                        <Check className="h-3 w-3" aria-hidden="true" />
                        Going
                      </>
                    ) : (
                      'Maybe'
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="calendar-suggested" className="space-y-3">
        <div>
          <h2 id="calendar-suggested" className="rail-heading">
            You might want to be there
          </h2>
          <p className="text-pana-ink/55 mt-1 text-[13px] font-bold">
            From groups you&rsquo;re in and Panas you follow. Nothing here is on
            your calendar yet.
          </p>
        </div>

        <ul className="space-y-2.5">
          {suggested.map((event) => (
            <li
              key={event.id}
              className="profile-card flex items-start gap-3.5 p-4"
            >
              <span className="bg-pana-butter/70 flex h-12 w-12 flex-none flex-col items-center justify-center rounded-xl">
                <span className="text-[9.5px] leading-none font-black tracking-wide opacity-70">
                  {event.weekday}
                </span>
                <span className="text-[17px] leading-tight font-black">
                  {event.dateNum}
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <span className="text-[15.5px] leading-tight font-extrabold">
                  {event.title}
                </span>
                <span className="text-pana-ink/55 ml-2 text-[13px] font-bold">
                  {event.time}
                </span>
                <HostLine event={event} />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <AttendeeCount count={event.attendeeCount} />
                  {/* Unsolicited rows have to justify themselves or the page
                      reads as advertising. */}
                  {event.because ? (
                    <span className="text-pana-ink/45 text-[12.5px] font-bold">
                      {event.because}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-none flex-col gap-1.5">
                <button
                  type="button"
                  className="bg-pana-indigo rounded-full px-3 py-1.5 text-[12px] font-black text-white"
                >
                  I&rsquo;m going
                </button>
                <button
                  type="button"
                  className="border-pana-ink/15 text-pana-ink/60 rounded-full border-2 px-3 py-1 text-[12px] font-black"
                >
                  Maybe
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-pana-ink/45 flex items-start gap-2 text-[12.5px] leading-snug font-bold">
        <CalendarDays className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        Every event already exports as .ics one at a time. A whole-calendar
        subscription is the obvious next step and is not mocked here.
      </p>
    </div>
  );
}
