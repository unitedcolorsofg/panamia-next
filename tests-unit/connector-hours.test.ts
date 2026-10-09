import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  EMPTY_LOAD,
  HOUR_PRESETS,
  MAX_MINUTES,
  describeLoad,
  formatMinutes,
  loadBand,
  minutesToHoursInput,
  parseHours,
} from '@/lib/connectors/hours';
import { isoToLocalInput, localInputToIso } from '@/lib/datetime-local';

/**
 * The pure half of commitment sizing.
 *
 * None of this touches a database, which is the point: `lib/connectors/
 * hours.ts` was deliberately split from `commitments.ts` so the parsing and
 * formatting could be exercised without a connection, and so the assign form
 * could import it without pulling Drizzle into the browser bundle.
 */

/* ------------------------------------------------------------- parseHours */

test('parseHours: blank is null, not a rejection', () => {
  // The distinction the whole load feature rests on. Blank means "nobody has
  // estimated this", which is a legitimate state of a real commitment;
  // 'invalid' means the input was refused. Collapsing them would either
  // reject empty forms or silently store garbage.
  assert.equal(parseHours(''), null);
  assert.equal(parseHours('   '), null);
});

test('parseHours: decimals, with either separator', () => {
  assert.equal(parseHours('1.5'), 90);
  assert.equal(parseHours('1,5'), 90);
  assert.equal(parseHours('0.25'), 15);
  assert.equal(parseHours('2'), 120);
  assert.equal(parseHours(' 3 '), 180);
});

test('parseHours: rejects what the CHECK would reject', () => {
  assert.equal(parseHours('0'), 'invalid');
  assert.equal(parseHours('-1'), 'invalid');
  assert.equal(parseHours('abc'), 'invalid');
  assert.equal(parseHours('1h'), 'invalid');
  assert.equal(parseHours('Infinity'), 'invalid');
});

test('parseHours: bounds match drizzle/0059 exactly', () => {
  // If these drift from the CHECK, bad input becomes a 500 from the database
  // rather than a 400 from the route.
  assert.equal(parseHours('100'), MAX_MINUTES);
  assert.equal(parseHours('100.01'), 'invalid');
  assert.equal(parseHours('101'), 'invalid');
});

test('parseHours: a fraction of a minute fails rather than rounding to zero', () => {
  // 0.001h is 0.06 minutes. Rounding first would store 0 and trip the CHECK
  // at the database instead of being caught here.
  assert.equal(parseHours('0.001'), 'invalid');
});

/* ----------------------------------------------------------- formatMinutes */

test('formatMinutes: reads the way somebody would say it', () => {
  assert.equal(formatMinutes(30), '30m');
  assert.equal(formatMinutes(60), '1h');
  assert.equal(formatMinutes(90), '1h 30m');
  assert.equal(formatMinutes(120), '2h');
  assert.equal(formatMinutes(MAX_MINUTES), '100h');
});

test('formatMinutes: nothing is "0h", never "0h 0m"', () => {
  assert.equal(formatMinutes(0), '0h');
  assert.equal(formatMinutes(-5), '0h');
  assert.equal(formatMinutes(Number.NaN), '0h');
});

/* ------------------------------------------------- round-tripping the form */

test('minutesToHoursInput inverts parseHours for every preset', () => {
  // The presets set the field's value as a string; that string has to parse
  // back to the minutes it came from, or tapping "2h" would store something
  // other than two hours.
  for (const minutes of HOUR_PRESETS) {
    assert.equal(parseHours(minutesToHoursInput(minutes)), minutes);
  }
});

test('minutesToHoursInput: blank for nothing, no trailing zeroes', () => {
  assert.equal(minutesToHoursInput(null), '');
  assert.equal(minutesToHoursInput(0), '');
  assert.equal(minutesToHoursInput(60), '1');
  assert.equal(minutesToHoursInput(90), '1.5');
});

/* ------------------------------------------------------------ describeLoad */

test('describeLoad: nothing open', () => {
  assert.equal(describeLoad(EMPTY_LOAD), 'Nothing open');
});

test('describeLoad: always says what the total leaves out', () => {
  // The clause that stops a busy person reading as a free one.
  assert.equal(
    describeLoad({ open: 4, estimatedMinutes: 360, unestimated: 2 }),
    '6h across 4 open · 2 not sized'
  );
  assert.equal(
    describeLoad({ open: 4, estimatedMinutes: 360, unestimated: 0 }),
    '6h across 4 open'
  );
});

test('describeLoad: work with no estimates at all does not read as zero hours', () => {
  assert.equal(
    describeLoad({ open: 3, estimatedMinutes: 0, unestimated: 3 }),
    '3 open · none sized'
  );
});

/* ---------------------------------------------------------------- loadBand */

test('loadBand: an empty board is free regardless of the roster', () => {
  assert.equal(loadBand(EMPTY_LOAD, 0), 'free');
  assert.equal(loadBand(EMPTY_LOAD, 600), 'free');
});

test('loadBand: nobody sized anything, so nobody is banded off a zero total', () => {
  // busiest === 0 with open work means the minutes say nothing. Banding this
  // as 'light' would claim someone carrying three jobs has room.
  assert.equal(
    loadBand({ open: 3, estimatedMinutes: 0, unestimated: 3 }, 0),
    'steady'
  );
});

test('loadBand: scaled against the roster maximum, not a capacity', () => {
  const busiest = 600;
  assert.equal(
    loadBand({ open: 1, estimatedMinutes: 600, unestimated: 0 }, busiest),
    'heaviest'
  );
  assert.equal(
    loadBand({ open: 1, estimatedMinutes: 300, unestimated: 0 }, busiest),
    'steady'
  );
  assert.equal(
    loadBand({ open: 1, estimatedMinutes: 60, unestimated: 0 }, busiest),
    'light'
  );
});

/* --------------------------------------------------------- datetime-local */

test('localInputToIso: a wall-clock string becomes a real instant', () => {
  const iso = localInputToIso('2026-11-03T17:00');
  assert.ok(iso, 'expected an instant');
  // Parsed in this runtime's zone, which is the whole point of doing it in
  // the browser — so assert the shape and the round trip, not a fixed offset.
  assert.match(iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(isoToLocalInput(iso), '2026-11-03T17:00');
});

test('localInputToIso: blank and nonsense are null, not Invalid Date', () => {
  assert.equal(localInputToIso(''), null);
  assert.equal(localInputToIso('   '), null);
  assert.equal(localInputToIso('tuesday'), null);
  assert.equal(localInputToIso('2026-13-45T99:99'), null);
});

test('isoToLocalInput: round-trips a stored instant back into the field', () => {
  const field = '2026-06-15T09:30';
  const iso = localInputToIso(field);
  assert.ok(iso);
  assert.equal(isoToLocalInput(iso), field);
});

test('isoToLocalInput: nothing in, nothing out', () => {
  assert.equal(isoToLocalInput(null), '');
  assert.equal(isoToLocalInput(undefined), '');
  assert.equal(isoToLocalInput(''), '');
  assert.equal(isoToLocalInput('not a date'), '');
});
