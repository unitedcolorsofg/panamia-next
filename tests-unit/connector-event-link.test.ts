import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  EMPTY_STAFFING,
  describeStaffing,
  eventColumns,
  eventValue,
  isUnderstaffed,
  parseEventValue,
} from '@/lib/connectors/event-link';
import { formatMinutes } from '@/lib/connectors/hours';

/**
 * Attaching a commitment to an event, minus the database.
 *
 * The encoding below crosses a network boundary — the assign form writes it
 * into an `<option value>`, the route reads it back out — so both halves have
 * to agree about every malformed case, not just the happy one. These tests
 * are the agreement.
 */

/* --------------------------------------------------- eventValue round-trip */

test('eventValue / parseEventValue: round-trips both kinds', () => {
  for (const kind of ['public', 'programme'] as const) {
    const id = 'clh3x9k2p0000qwer1234asdf';
    assert.deepEqual(parseEventValue(eventValue({ kind, id })), { kind, id });
  }
});

test('parseEventValue: an id containing a colon still round-trips', () => {
  // cuid2 is alphanumeric so this cannot happen today, but the parser splits
  // on the *first* colon rather than on all of them specifically so that a
  // future id format does not silently truncate into a wrong reference.
  const id = 'weird:id:with:colons';
  assert.deepEqual(parseEventValue(eventValue({ kind: 'public', id })), {
    kind: 'public',
    id,
  });
});

/* --------------------------------------------------- parseEventValue: no */

test('parseEventValue: the empty string is null, not a throw', () => {
  // This is what the "Not tied to an event" option carries. It reaches the
  // parser only if a caller forgets to check first, and the answer has to be
  // "nothing selected" rather than an exception taking down the request.
  assert.equal(parseEventValue(''), null);
});

test('parseEventValue: rejects a value with no separator', () => {
  assert.equal(parseEventValue('clh3x9k2p0000qwer1234asdf'), null);
});

test('parseEventValue: rejects a leading colon', () => {
  // indexOf would return 0, which is falsy-adjacent in a way that a `>= 0`
  // check would wave through as an empty kind. The guard is `> 0`.
  assert.equal(parseEventValue(':clh3x9k2p0000qwer1234asdf'), null);
});

test('parseEventValue: rejects an unknown kind', () => {
  assert.equal(parseEventValue('venue:clh3x9k2p0000qwer1234asdf'), null);
  assert.equal(parseEventValue('PUBLIC:clh3x9k2p0000qwer1234asdf'), null);
});

test('parseEventValue: rejects an empty id', () => {
  assert.equal(parseEventValue('public:'), null);
});

/* ------------------------------------------------------------ eventColumns */

test('eventColumns: null clears both', () => {
  assert.deepEqual(eventColumns(null), {
    eventId: null,
    connectorEventId: null,
  });
});

test('eventColumns: never sets both, whichever kind it is', () => {
  // The CHECK in drizzle/0061 refuses a row with both set, so this function
  // is the one place that could turn a valid choice into a 500. Each branch
  // writes an explicit null alongside the value rather than omitting it.
  const id = 'clh3x9k2p0000qwer1234asdf';

  assert.deepEqual(eventColumns({ kind: 'public', id }), {
    eventId: id,
    connectorEventId: null,
  });
  assert.deepEqual(eventColumns({ kind: 'programme', id }), {
    eventId: null,
    connectorEventId: id,
  });
});

/* --------------------------------------------------------- describeStaffing */

test('describeStaffing: nobody, with and without a target', () => {
  assert.equal(
    describeStaffing(EMPTY_STAFFING, null, formatMinutes),
    'nobody yet'
  );
  assert.equal(
    describeStaffing(EMPTY_STAFFING, 5, formatMinutes),
    'nobody yet of 5'
  );
});

test('describeStaffing: a target becomes a denominator only when set', () => {
  const staffing = { connectors: 3, estimatedMinutes: 0, unestimated: 0 };

  assert.equal(describeStaffing(staffing, 5, formatMinutes), '3 of 5');
  // Without a target the same three people are reported as a fact, not as a
  // shortfall. Inventing a denominator would turn "we have three" into "we
  // are short two", which is a different and unearned claim.
  assert.equal(describeStaffing(staffing, null, formatMinutes), '3 assigned');
});

test('describeStaffing: hours are appended only when something is sized', () => {
  assert.equal(
    describeStaffing(
      { connectors: 2, estimatedMinutes: 360, unestimated: 0 },
      null,
      formatMinutes
    ),
    '2 assigned · 6h'
  );
});

test('describeStaffing: unsized work is reported, not folded into the hours', () => {
  // "3 of 5 · 6h" and "3 of 5 · 6h · 1 not sized" describe the same hours at
  // different levels of confidence. Dropping the second clause would quietly
  // present a partial total as a complete one.
  assert.equal(
    describeStaffing(
      { connectors: 3, estimatedMinutes: 360, unestimated: 1 },
      5,
      formatMinutes
    ),
    '3 of 5 · 6h · 1 not sized'
  );
});

test('describeStaffing: all unsized still names the crew', () => {
  assert.equal(
    describeStaffing(
      { connectors: 2, estimatedMinutes: 0, unestimated: 2 },
      null,
      formatMinutes
    ),
    '2 assigned · 2 not sized'
  );
});

/* ----------------------------------------------------------- isUnderstaffed */

test('isUnderstaffed: an event that never asked is not short', () => {
  // The distinction the staffing panel sorts on. An event with no target is
  // unquantified, not behind — flagging it would put every casual gathering
  // on the same list as the one genuinely missing people.
  assert.equal(isUnderstaffed(EMPTY_STAFFING, null), false);
  assert.equal(
    isUnderstaffed({ connectors: 0, estimatedMinutes: 0, unestimated: 0 }, 0),
    false
  );
});

test('isUnderstaffed: short, exactly met, and over', () => {
  const at = (connectors: number) => ({
    connectors,
    estimatedMinutes: 0,
    unestimated: 0,
  });

  assert.equal(isUnderstaffed(at(2), 5), true);
  assert.equal(isUnderstaffed(at(5), 5), false);
  // Over target is not a problem to report. More people turning up than were
  // asked for is a good day, not a condition needing attention.
  assert.equal(isUnderstaffed(at(7), 5), false);
});
