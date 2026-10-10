'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { redirect } from 'next/navigation';
import {
  CalendarDays,
  Check,
  Globe,
  Lock,
  MapPin,
  Users,
  ArrowRight,
} from 'lucide-react';
import SurfaceLink from '@/components/panaverse/SurfaceLink';
import { useSession } from '@/lib/auth-client';
import { SocialEligibilityGate } from '@/components/social';
import {
  socialQueryKey,
  useMyCalendar,
  type CalendarEntry,
  type CalendarHostKind,
} from '@/lib/query/social';
import {
  dateKey,
  formatDayHeading,
  formatTime,
  formatWeekdayLong,
  relativeDayLabel,
} from '@/lib/events/format';

/* The full personal calendar.
 *
 * Answers the one question no other surface can: what am I actually doing.
 * Today that answer is split three ways -- a group's events are on the group
 * page, a pana's are on their profile, a listing's are on /e -- and none of
 * those knows what you said yes to.
 *
 * Not a replacement for /e. /e is the public explore page: everything on,
 * whether or not it has anything to do with you, and it is the events surface
 * that gets indexed. This is the opposite, and is noindex by definition
 * because half of it is derived from who you follow.
 *
 * The structural decision is the split between committed and suggested. They
 * are never interleaved. Merging them would make the page unusable for the
 * thing it exists for, which is finding out what you have promised -- and it
 * is how a quiet calendar gets padded out to look busy.
 *
 * The mock had a third host kind, "Directory". There isn't one: an event has
 * host_profile_id XOR host_group_id, enforced by events_single_host, and a
 * directory listing hosts through its profile. So a listing's event is a
 * pana-hosted event and is labelled accordingly rather than being given a
 * badge the data cannot tell apart.
 */

const HOST_LABEL: Record<CalendarHostKind, string> = {
  group: 'Group',
  pana: 'Pana',
};

const HOST_TONE: Record<CalendarHostKind, string> = {
  group: 'bg-pana-indigo/10 text-pana-indigo',
  pana: 'bg-pana-burnt/10 text-pana-burnt',
};

function HostLine({ entry }: { entry: CalendarEntry }) {
  const host = entry.hostHandle ? (
    <Link
      href={
        entry.hostKind === 'group'
          ? `/g/${entry.hostHandle}`
          : `/p/${entry.hostHandle}`
      }
      className="text-pana-ink/70 text-[13px] font-bold hover:underline"
    >
      {entry.hostName}
    </Link>
  ) : (
    <span className="text-pana-ink/70 text-[13px] font-bold">
      {entry.hostName}
    </span>
  );

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={`rounded-full px-2 py-0.5 text-[10.5px] font-black tracking-wide uppercase ${HOST_TONE[entry.hostKind]}`}
      >
        {HOST_LABEL[entry.hostKind]}
      </span>
      {host}
      {/* An online event has no venue, so there is nothing to put here and the
          separator that would precede it must not render either. */}
      {entry.mode === 'online' ? (
        <span className="text-pana-ink/50 inline-flex items-center gap-1 text-[13px] font-bold">
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          Online
        </span>
      ) : entry.venueName || entry.venueCity ? (
        <span className="text-pana-ink/50 inline-flex items-center gap-1 text-[13px] font-bold">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {[entry.venueName, entry.venueCity].filter(Boolean).join(' · ')}
        </span>
      ) : null}
    </div>
  );
}

function AttendeeCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="text-pana-ink/50 inline-flex items-center gap-1 text-[12.5px] font-bold">
      <Users className="h-3.5 w-3.5" aria-hidden="true" />
      {count} going
    </span>
  );
}

function UnlistedBadge() {
  return (
    <span className="bg-pana-ink/8 text-pana-ink/60 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-black tracking-wide uppercase">
      <Lock className="h-3 w-3" aria-hidden="true" />
      Unlisted
    </span>
  );
}

/** Groups entries into calendar days, in each event's own timezone. */
function byDay(entries: CalendarEntry[]) {
  const days: {
    key: string;
    weekday: string;
    date: string;
    isToday: boolean;
    entries: CalendarEntry[];
  }[] = [];

  for (const entry of entries) {
    const at = new Date(entry.startsAt);
    const key = dateKey(at, entry.timezone);
    let day = days.find((candidate) => candidate.key === key);
    if (!day) {
      day = {
        key,
        weekday: formatWeekdayLong(at, entry.timezone),
        date: formatDayHeading(at, entry.timezone),
        isToday: relativeDayLabel(at, entry.timezone) === 'Today',
        entries: [],
      };
      days.push(day);
    }
    day.entries.push(entry);
  }

  return days;
}

function RsvpButtons({ entry }: { entry: CalendarEntry }) {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<'going' | 'maybe' | null>(null);

  const rsvp = useMutation({
    mutationFn: (status: 'going' | 'maybe') =>
      axios.post(`/api/events/${encodeURIComponent(entry.slug)}/rsvp`, {
        status,
      }),
    onSuccess: (_result, status) => {
      setChosen(status);
      /* The row has to move from suggested to committed, and only the server
         can decide that, so the whole calendar is refetched rather than
         patched locally. */
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'me', 'calendar'],
      });
    },
  });

  if (chosen) {
    return (
      <span className="text-pana-indigo flex-none text-[12px] font-black">
        {chosen === 'going' ? 'Going' : 'Maybe'}
      </span>
    );
  }

  return (
    <div className="flex flex-none flex-col gap-1.5">
      <button
        type="button"
        disabled={rsvp.isPending}
        onClick={() => rsvp.mutate('going')}
        className="bg-pana-indigo rounded-full px-3 py-1.5 text-[12px] font-black text-white disabled:opacity-50"
      >
        I&rsquo;m going
      </button>
      <button
        type="button"
        disabled={rsvp.isPending}
        onClick={() => rsvp.mutate('maybe')}
        className="border-pana-ink/15 text-pana-ink/60 rounded-full border-2 px-3 py-1 text-[12px] font-black disabled:opacity-50"
      >
        Maybe
      </button>
    </div>
  );
}

export function CalendarPage() {
  const { status } = useSession();

  if (status === 'unauthenticated') {
    redirect(`/signin?callbackUrl=${encodeURIComponent('/s/calendar')}`);
  }

  return (
    <main className="surface-cream min-h-screen pb-20">
      <div className="container mx-auto max-w-3xl px-4 pt-8">
        <SocialEligibilityGate>
          <CalendarContent />
        </SocialEligibilityGate>
      </div>
    </main>
  );
}

function CalendarContent() {
  const { data, isLoading, isError, refetch } = useMyCalendar();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="bg-pana-ink/10 h-16 rounded-2xl" />
        <div className="bg-pana-ink/10 h-40 rounded-2xl" />
        <div className="bg-pana-ink/10 h-40 rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="reserved-slot items-start p-6">
        <p className="reserved-slot-title">That didn&apos;t load</p>
        <p className="text-pana-ink/65 text-[13px] leading-snug font-medium">
          Something went wrong fetching your calendar. This is a problem on our
          side, not an empty calendar.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-pana-indigo mt-2 text-[13px] font-extrabold hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const committed = data?.committed ?? [];
  const suggested = data?.suggested ?? [];
  const days = byDay(committed);

  const going = committed.filter((entry) => entry.rsvp === 'going').length;
  const maybe = committed.filter((entry) => entry.rsvp === 'maybe').length;
  const hosting = committed.filter(
    (entry) => entry.reason === 'hosting'
  ).length;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-[26px] leading-tight font-black">Your calendar</h1>
        <p className="text-pana-ink/60 mt-1 text-[14.5px] font-bold">
          <CalendarSummary going={going} maybe={maybe} hosting={hosting} />
        </p>
      </header>

      {committed.length > 0 ? (
        <section aria-labelledby="calendar-going" className="space-y-3">
          <h2 id="calendar-going" className="rail-heading">
            You&rsquo;re going
          </h2>

          {days.map((day) => (
            <div key={day.key} className="profile-card overflow-hidden">
              <div className="border-pana-ink/8 bg-pana-butter/30 flex items-baseline gap-2 border-b px-4 py-2.5">
                <span
                  className={`text-[14px] font-black ${day.isToday ? 'text-pana-burnt' : ''}`}
                >
                  {day.isToday ? 'Today' : day.weekday}
                </span>
                <span className="text-pana-ink/45 text-[12.5px] font-bold">
                  {day.date}
                </span>
                {/* Two things in one day is the case a list of cards hides and
                    a calendar has to surface. */}
                {day.entries.length > 1 ? (
                  <span className="text-pana-burnt ml-auto text-[12px] font-black">
                    {day.entries.length} events
                  </span>
                ) : null}
              </div>

              <ul className="divide-pana-ink/8 divide-y">
                {day.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start gap-3.5 px-4 py-3.5"
                  >
                    <span className="w-[72px] flex-none pt-0.5 text-[13.5px] font-black">
                      {formatTime(new Date(entry.startsAt), entry.timezone)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/e/${entry.slug}`}
                          className="text-[15.5px] leading-tight font-extrabold hover:underline"
                        >
                          {entry.title}
                        </Link>
                        {entry.visibility === 'unlisted' ? (
                          <UnlistedBadge />
                        ) : null}
                      </div>
                      <HostLine entry={entry} />
                      <div className="mt-2 flex items-center gap-3">
                        <AttendeeCount count={entry.attendeeCount} />
                      </div>
                    </div>

                    {/* Hosting is a commitment, but it is not an RSVP and must
                        not be dressed as one. */}
                    <span
                      className={`inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-black ${
                        entry.reason === 'hosting'
                          ? 'bg-pana-burnt text-white'
                          : entry.rsvp === 'going'
                            ? 'bg-pana-indigo text-white'
                            : 'border-pana-ink/15 text-pana-ink/60 border-2'
                      }`}
                    >
                      {entry.reason === 'hosting' ? (
                        'Hosting'
                      ) : entry.rsvp === 'going' ? (
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
      ) : (
        <div className="reserved-slot items-start p-6">
          <p className="reserved-slot-title">Nothing on your calendar yet</p>
          <p className="text-pana-ink/65 text-[13px] leading-snug font-medium">
            When you RSVP to an event, or host one, it lands here. Everything
            you have said yes to in one place, across your groups and your
            Panas.
          </p>
          <SurfaceLink
            href="/e"
            className="link-arrow text-pana-indigo mt-2 text-[13px] font-extrabold"
          >
            See what&rsquo;s on
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </SurfaceLink>
        </div>
      )}

      {suggested.length > 0 ? (
        <section aria-labelledby="calendar-suggested" className="space-y-3">
          <div>
            <h2 id="calendar-suggested" className="rail-heading">
              You might want to be there
            </h2>
            <p className="text-pana-ink/55 mt-1 text-[13px] font-bold">
              From groups you&rsquo;re in and Panas you follow. Nothing here is
              on your calendar yet.
            </p>
          </div>

          <ul className="space-y-2.5">
            {suggested.map((entry) => {
              const at = new Date(entry.startsAt);
              return (
                <li
                  key={entry.id}
                  className="profile-card flex items-start gap-3.5 p-4"
                >
                  <span className="bg-pana-butter/70 flex h-12 w-12 flex-none flex-col items-center justify-center rounded-xl">
                    <span className="text-[9.5px] leading-none font-black tracking-wide uppercase opacity-70">
                      {formatWeekdayLong(at, entry.timezone).slice(0, 3)}
                    </span>
                    <span className="text-[17px] leading-tight font-black">
                      {at.getDate()}
                    </span>
                  </span>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/e/${entry.slug}`}
                      className="text-[15.5px] leading-tight font-extrabold hover:underline"
                    >
                      {entry.title}
                    </Link>
                    <span className="text-pana-ink/55 ml-2 text-[13px] font-bold">
                      {formatTime(at, entry.timezone)}
                    </span>
                    <HostLine entry={entry} />
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <AttendeeCount count={entry.attendeeCount} />
                      {/* An unsolicited row that cannot say why it is here
                          reads as advertising. */}
                      {entry.because ? (
                        <span className="text-pana-ink/45 text-[12.5px] font-bold">
                          {entry.because}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <RsvpButtons entry={entry} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="text-pana-ink/45 flex items-start gap-2 text-[12.5px] leading-snug font-bold">
        <CalendarDays className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        Showing the next 60 days. Every event exports as .ics from its own page;
        a whole-calendar subscription is the obvious next step.
      </p>
    </div>
  );
}

/* Counts are spelled out rather than summed into one number, because "4
   events" would be a lie about the maybe -- and the maybe is the one the
   reader most needs reminding of. */
function CalendarSummary({
  going,
  maybe,
  hosting,
}: {
  going: number;
  maybe: number;
  hosting: number;
}) {
  const parts: string[] = [];
  if (hosting > 0) {
    parts.push(`${hosting} you're hosting`);
  }
  if (going > 0) {
    parts.push(`${going} you're going to`);
  }
  if (maybe > 0) {
    parts.push(`${maybe} you haven't decided on`);
  }

  if (parts.length === 0) {
    return <>Across your groups, your Panas, and the directory.</>;
  }

  const sentence =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

  return <>{sentence}, across your groups, your Panas, and the directory.</>;
}
