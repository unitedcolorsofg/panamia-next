/**
 * Formatting events in their own timezone.
 *
 * Lives apart from any one surface because an event is on the day its own city
 * says it is, and that rule has to hold identically on discovery, the group
 * rail and the personal calendar or the three will disagree about what day
 * something is. These were private to lib/events/discovery.ts until the
 * calendar needed them too; a second copy would have been a second set of DST
 * bugs waiting to diverge.
 *
 * Intl rather than arithmetic throughout: it gets daylight saving right, and
 * every one of these is a formatter call that hand-rolled date maths would
 * only approximate.
 */

/**
 * Intl, with a bad timezone treated as missing rather than fatal.
 *
 * `timezone` is a free text column, so a bad value is a data problem, not a
 * code one — and a data problem should cost one wrong clock face, not the
 * whole page. Falls back to the reader's zone, which is wrong in the way a
 * calendar is normally wrong rather than in the way a crash is.
 */
function fmt(options: Intl.DateTimeFormatOptions, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone });
  } catch {
    return new Intl.DateTimeFormat('en-US', options);
  }
}

/**
 * The calendar date in a given timezone, as YYYY-MM-DD.
 *
 * `en-CA` rather than arithmetic on a Date: it is the one common locale whose
 * short date format is already ISO order, so this is a formatter call rather
 * than three getters and a pad.
 */
export function dateKey(at: Date, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  try {
    return new Intl.DateTimeFormat('en-CA', { ...options, timeZone }).format(
      at
    );
  } catch {
    return new Intl.DateTimeFormat('en-CA', options).format(at);
  }
}

/** 0 = Sunday, in the given timezone. */
export function weekday(at: Date, timeZone: string): number {
  const name = fmt({ weekday: 'short' }, timeZone).format(at);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/** "Fri 20 Feb, 7:00 PM", in the event's own timezone -- a show at 8pm in
 *  Miami is at 8pm on the page wherever it is read from. */
export function formatWhen(at: Date, timeZone: string): string {
  const date = fmt(
    { weekday: 'short', day: 'numeric', month: 'short' },
    timeZone
  ).format(at);
  const time = fmt({ hour: 'numeric', minute: '2-digit' }, timeZone).format(at);
  return `${date}, ${time}`;
}

/** "Fri 20" — the calendar tab's day heading. */
export function formatDay(at: Date, timeZone: string): string {
  return fmt({ weekday: 'short', day: 'numeric' }, timeZone).format(at);
}

/** Just the clock part: "7:00 PM". */
export function formatTime(at: Date, timeZone: string): string {
  return fmt({ hour: 'numeric', minute: '2-digit' }, timeZone).format(at);
}

/**
 * A day heading that says the weekday once.
 *
 * "Saturday · Oct 11", not "Saturday · Sat the 11" — the long weekday carries
 * the day of the week, so the date beside it only needs to carry the date.
 */
export function formatDayHeading(at: Date, timeZone: string): string {
  return fmt({ month: 'short', day: 'numeric' }, timeZone).format(at);
}

/** The long weekday name: "Saturday". */
export function formatWeekdayLong(at: Date, timeZone: string): string {
  return fmt({ weekday: 'long' }, timeZone).format(at);
}

/**
 * How far out a day is, in whole calendar days, from the viewer's today.
 *
 * Compares date keys rather than subtracting timestamps so an event at 1am
 * tomorrow is one day away rather than a few hours, which is how people read
 * a calendar.
 */
export function daysFromToday(
  at: Date,
  timeZone: string,
  now: Date = new Date()
): number {
  const today = dateKey(now, timeZone);
  const day = dateKey(at, timeZone);
  return Math.round(
    (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000
  );
}

/** "Today", "Tomorrow", or the long weekday. */
export function relativeDayLabel(
  at: Date,
  timeZone: string,
  now: Date = new Date()
): string {
  const out = daysFromToday(at, timeZone, now);
  if (out === 0) return 'Today';
  if (out === 1) return 'Tomorrow';
  return formatWeekdayLong(at, timeZone);
}
