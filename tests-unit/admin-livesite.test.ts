/**
 * Tests for how the live-site dashboard describes a trend.
 *
 * `trendNote` turns two counts into the line under a headline number. It is
 * small, but it is the part of that page a reader actually believes, and the
 * ways it can lie are specific:
 *
 *   - a percentage against a previous window of zero reads as infinite growth
 *   - "up 100%" from a base of one is arithmetically true and worthless
 *   - a flat week rendered as "up from N" quietly invents movement
 *
 * So the rule is that it never produces a ratio, and the cases below pin the
 * boundaries rather than the prose. No database: this takes two numbers.
 *
 * Importing from lib/admin/livesite.ts also exercises something worth having
 * covered — that module imports `db`, and `db` is a lazy Proxy in lib/db.ts.
 * If it were ever built eagerly instead, this file would fail to import with
 * no connection string, which is a cheaper place to find that out than a
 * deploy.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { trendNote, type Trend } from '@/lib/admin/livesite';

const WINDOW = 'last 7 days';

function note(current: number, previous: number) {
  return trendNote({ current, previous } satisfies Trend, WINDOW);
}

describe('trendNote', () => {
  test('never reports a percentage', () => {
    // The whole point. Checked across the range rather than case by case,
    // because the failure would arrive as a well-meaning refactor that adds
    // one, not as a change to any single branch below.
    const pairs: readonly [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [5, 5],
      [9, 3],
      [3, 9],
      [1000, 1],
    ];
    for (const [current, previous] of pairs) {
      assert.doesNotMatch(
        note(current, previous),
        /%|Infinity|NaN/,
        `${current} vs ${previous} should not quote a ratio`
      );
    }
  });

  test('a previous window of zero is stated, not divided by', () => {
    assert.equal(note(4, 0), `${WINDOW}, none before`);
  });

  test('nothing at all in either window just names the window', () => {
    // The commonest state on a young queue, and the one that should be
    // quietest: no claim about direction when there is no direction.
    assert.equal(note(0, 0), WINDOW);
  });

  test('a flat week is called flat rather than given a direction', () => {
    assert.equal(note(7, 7), `${WINDOW}, level with the week before`);
  });

  test('a rise names the number it rose from', () => {
    assert.equal(note(9, 4), `${WINDOW}, up from 4`);
  });

  test('a fall is called a fall', () => {
    // The direction that must not be reported as growth. A dashboard that
    // renders a drop in signups as "up from" is worse than one showing
    // nothing, because somebody will act on it.
    assert.equal(note(2, 8), `${WINDOW}, down from 8`);
  });

  test('a drop to zero still reads as a fall', () => {
    assert.equal(note(0, 6), `${WINDOW}, down from 6`);
  });

  test('the window label is passed through verbatim', () => {
    // The caller owns the wording; this function only ever appends to it.
    for (const w of ['last 7 days', 'last 30 days']) {
      assert.ok(trendNote({ current: 3, previous: 1 }, w).startsWith(w));
    }
  });
});
