/**
 * Commitment size, in the two units it has to live in.
 *
 * Stored as integer minutes so `SUM()` is exact; typed and read as hours,
 * because "an hour and a half" is how anybody describes a piece of work.
 * Everything that crosses between those two units goes through here, so the
 * conversion exists once rather than in each form that collects it.
 *
 * Dependency-free on purpose. The assign form is a client component and the
 * tests run in bare node, so anything either of them needs cannot sit in a
 * module that imports `db` — doing that pulls Drizzle and a database
 * connection into the browser bundle. `lib/admin/user-locks.ts` was split out
 * of `lib/admin/users.ts` for exactly this reason; this file starts on the
 * right side of that line instead of being moved later.
 */

/** Matches the CHECK in drizzle/0059: 100 hours, in minutes. */
export const MAX_MINUTES = 6000;
export const MAX_HOURS = MAX_MINUTES / 60;

/**
 * The sizes offered as buttons, in minutes.
 *
 * Presets rather than a free number field as the primary input, because the
 * estimate is the thing most likely to be skipped and a dropdown of plausible
 * answers is the difference between people filling it in and people leaving it
 * blank. Typing an exact figure stays available for the work that needs it.
 *
 * The spread is deliberately coarse at the top: nobody usefully distinguishes
 * a seven-hour commitment from an eight-hour one, and offering that precision
 * implies the estimate is load-bearing when it is a planning aid.
 */
export const HOUR_PRESETS: readonly number[] = [30, 60, 120, 240, 480];

/**
 * Minutes as a person would say them.
 *
 * "45m", "2h", "2h 30m". No zero-padding and no bare "0h" — a commitment
 * cannot be zero minutes (the CHECK forbids it), so the only way to reach
 * this with nothing is a caller that should have handled NULL itself.
 */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0h';

  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;

  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/**
 * What somebody typed in an hours field, as minutes.
 *
 * Returns `null` for blank, which is the legitimate "nobody has estimated
 * this" answer and must not be confused with a rejection. Returns `'invalid'`
 * for anything the CHECK would refuse, so the caller can tell the two apart
 * and say something useful about each.
 *
 * Accepts "1.5" and "1,5" — the comma because the decimal separator is a
 * keyboard-layout accident rather than an opinion about the number, and
 * rejecting it would read as the form not working.
 */
export function parseHours(input: string): number | null | 'invalid' {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hours = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(hours) || hours <= 0) return 'invalid';

  /* Rounded to the minute before the bounds check, so 0.001 hours fails as
   * "too small" rather than passing as a fraction of a minute that stores as
   * zero and trips the CHECK at the database instead. */
  const minutes = Math.round(hours * 60);
  if (minutes <= 0 || minutes > MAX_MINUTES) return 'invalid';

  return minutes;
}

/** Minutes back into a form field. The inverse of `parseHours` for round-trips. */
export function minutesToHoursInput(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '';
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * One connector's load, counted rather than scored.
 *
 * Three numbers and not one, because a single figure cannot be honest here.
 * `estimatedMinutes` is a total over only the commitments somebody has sized,
 * and `unestimated` says how many were left out of it. A page that showed the
 * total alone would read as complete and under-report anyone whose work was
 * never estimated — which is every row written before drizzle/0059.
 */
export interface ConnectorLoad {
  /** Commitments not marked done. */
  open: number;
  /** Summed size of the open commitments that have one. */
  estimatedMinutes: number;
  /** Open commitments with no estimate. Excluded from the total above. */
  unestimated: number;
}

export const EMPTY_LOAD: ConnectorLoad = {
  open: 0,
  estimatedMinutes: 0,
  unestimated: 0,
};

/**
 * Load as a sentence, including what the number leaves out.
 *
 * The caveat is part of the reading, not a footnote: "6h across 4" and "6h
 * across 4 · 2 not sized" describe very different people, and dropping the
 * second clause makes the busier of the two look like the freer one.
 */
export function describeLoad(load: ConnectorLoad): string {
  if (load.open === 0) return 'Nothing open';

  const work = `${load.open} open`;

  if (load.estimatedMinutes === 0) {
    return `${work} · none sized`;
  }

  const total = formatMinutes(load.estimatedMinutes);
  return load.unestimated > 0
    ? `${total} across ${work} · ${load.unestimated} not sized`
    : `${total} across ${work}`;
}

/**
 * Where this load sits against the rest of the roster.
 *
 * Relative, never absolute, because nobody has ever told us how much a
 * connector can take. The programme deck is emphatic that the tiers are not a
 * ranking and that "everyone starts in Tier 1", so there is no capacity to
 * divide by and a percentage-full bar would be inventing its own denominator.
 *
 * What can be said truthfully is how somebody compares to the people beside
 * them, which is the question being asked anyway: not "is Ana at 80%" but "who
 * has room right now". `busiest` is the roster's own maximum, so the scale
 * re-fits itself to whatever the programme is actually carrying.
 */
export type LoadBand = 'free' | 'light' | 'steady' | 'heaviest';

export function loadBand(load: ConnectorLoad, busiest: number): LoadBand {
  if (load.open === 0) return 'free';

  /* Everybody unestimated, so the minutes say nothing. Fall back to the one
   * fact available — they are carrying something — rather than banding them
   * as 'light' off a zero total they never reported. */
  if (busiest <= 0) return 'steady';

  const share = load.estimatedMinutes / busiest;
  if (share >= 0.8) return 'heaviest';
  if (share >= 0.4) return 'steady';
  return 'light';
}

export const LOAD_BAND_LABEL: Record<LoadBand, string> = {
  free: 'Has room',
  light: 'Light',
  steady: 'Steady',
  heaviest: 'Carrying the most',
};
