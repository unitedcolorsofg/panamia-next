/**
 * Tests for the machinery verdict in lib/admin/livesite.ts.
 *
 * The ordering of the checks is the thing under test, not the wording. A job
 * that has stopped running cannot report that it is failing, so the
 * "has it run at all" questions have to beat the "did it work" ones -- and
 * the cases that prove it (a dead cron, a ledger that was never migrated, a
 * Worker killed mid-sweep) are exactly the states nobody can produce on
 * demand in a browser. That is what makes them worth a test rather than a
 * look.
 *
 * Assertions are on `tone` and on the distinguishing noun in the headline,
 * never on whole sentences. Copy on this page is meant to be rewritten; the
 * classification is not.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  describeGap,
  machineryVerdict,
  type JobRunSummary,
  type MachinerySnapshot,
} from '../lib/admin/livesite';

const HOUR = 3600;

function run(over: Partial<JobRunSummary> = {}): JobRunSummary {
  return {
    trigger: '10 * * * *',
    startedAt: new Date('2026-10-10T10:10:00Z'),
    finishedAt: new Date('2026-10-10T10:10:04Z'),
    ok: true,
    errorCount: 0,
    secondsSinceStart: 20 * 60,
    durationSeconds: 4,
    storiesDeferred: 0,
    storiesDeleted: 0,
    mediaDeleted: 0,
    notificationsDeleted: 0,
    ...over,
  };
}

function snap(over: Partial<MachinerySnapshot> = {}): MachinerySnapshot {
  return {
    migrated: true,
    lastRun: run(),
    runs24h: 24,
    failures24h: 0,
    killed: 0,
    ...over,
  };
}

// --- the honest "we cannot tell" states -------------------------------------

test('an unmigrated ledger warns and says how to fix it', () => {
  const v = machineryVerdict(snap({ migrated: false, lastRun: null }));
  assert.equal(v.tone, 'warn');
  assert.match(v.headline, /ledger/i);
  // Must name the migration. A dashboard that says "no data" without saying
  // why is how an unapplied migration stays unapplied.
  assert.match(v.detail, /0063/);
});

test('an unmigrated ledger does not claim the sweep is broken', () => {
  // The purge runs fine without its ledger -- that is the whole design of
  // lib/jobs/ledger.ts. Reporting this as an alarm would send somebody
  // looking for a failure that is not there.
  const v = machineryVerdict(snap({ migrated: false, lastRun: null }));
  assert.notEqual(v.tone, 'alarm');
  assert.match(v.detail, /unaffected/i);
});

test('an empty ledger warns rather than alarming', () => {
  // The expected state for the first hour after deploy.
  const v = machineryVerdict(snap({ lastRun: null, runs24h: 0 }));
  assert.equal(v.tone, 'warn');
  assert.match(v.headline, /nothing recorded/i);
});

// --- has it run at all ------------------------------------------------------

test('a stopped cron is an alarm even though every recorded run passed', () => {
  // The case the whole band exists for. Nothing here is false: the last run
  // succeeded, there are no failures, no killed runs. The only evidence is
  // the gap.
  const v = machineryVerdict(
    snap({
      lastRun: run({ ok: true, secondsSinceStart: 9 * HOUR }),
      runs24h: 15,
      failures24h: 0,
    })
  );
  assert.equal(v.tone, 'alarm');
  assert.match(v.headline, /stopped/i);
});

test('one missed hour is not yet an alarm', () => {
  // A deploy landing on the hour must not cry wolf.
  const v = machineryVerdict(
    snap({ lastRun: run({ secondsSinceStart: 90 * 60 }) })
  );
  assert.equal(v.tone, 'ok');
});

test('a run in flight reads as ok, not as missing', () => {
  const v = machineryVerdict(
    snap({
      lastRun: run({ finishedAt: null, ok: null, secondsSinceStart: 30 }),
    })
  );
  assert.equal(v.tone, 'ok');
  assert.match(v.headline, /running now/i);
});

test('a run still open past the CPU budget is a distinct alarm', () => {
  // Killed mid-sweep, not "the schedule stopped". Different fix, so it must
  // not collapse into the staleness message.
  const v = machineryVerdict(
    snap({
      lastRun: run({ finishedAt: null, ok: null, secondsSinceStart: 3 * HOUR }),
      killed: 1,
    })
  );
  assert.equal(v.tone, 'alarm');
  assert.match(v.headline, /mid-sweep/i);
  assert.doesNotMatch(v.headline, /stopped$/i);
});

test('staleness outranks a failure on the same run', () => {
  // Both true. The gap is the one that needs acting on, because a job that
  // is not running will never correct itself.
  const v = machineryVerdict(
    snap({ lastRun: run({ ok: false, secondsSinceStart: 9 * HOUR }) })
  );
  assert.equal(v.tone, 'alarm');
  assert.match(v.headline, /stopped/i);
});

// --- did it work ------------------------------------------------------------

test('a recent failed run is an alarm', () => {
  const v = machineryVerdict(snap({ lastRun: run({ ok: false }) }));
  assert.equal(v.tone, 'alarm');
  assert.match(v.headline, /failed/i);
});

test('deferred media warns even though the run succeeded', () => {
  // The silent canary: ok = true, no errors, and R2 is refusing deletes.
  const v = machineryVerdict(
    snap({ lastRun: run({ ok: true, storiesDeferred: 12 }) })
  );
  assert.equal(v.tone, 'warn');
  assert.match(v.headline, /12 stories/);
});

test('deferred media is singular at one', () => {
  const v = machineryVerdict(snap({ lastRun: run({ storiesDeferred: 1 }) }));
  assert.match(v.headline, /1 story could not/);
});

test('deferred media outranks a plain error count', () => {
  // Both warn, so the tone cannot distinguish them; the headline must.
  // Deferred media is the more specific and more expensive of the two.
  const v = machineryVerdict(
    snap({ lastRun: run({ storiesDeferred: 3, errorCount: 3 }) })
  );
  assert.match(v.headline, /could not be cleared/i);
});

test('errors without deferrals warn on their own', () => {
  const v = machineryVerdict(snap({ lastRun: run({ errorCount: 2 }) }));
  assert.equal(v.tone, 'warn');
  assert.match(v.headline, /2 errors/);
});

test('a clean run after earlier failures still warns', () => {
  // Recovered, but somebody should know the day was rough.
  const v = machineryVerdict(snap({ failures24h: 3, runs24h: 24 }));
  assert.equal(v.tone, 'warn');
  assert.match(v.detail, /3 of the 24/);
});

test('earlier killed runs warn once the current one is clean', () => {
  const v = machineryVerdict(snap({ killed: 2 }));
  assert.equal(v.tone, 'warn');
  assert.match(v.headline, /cut short/i);
});

test('a healthy job is quiet', () => {
  const v = machineryVerdict(snap());
  assert.equal(v.tone, 'ok');
  assert.match(v.headline, /on schedule/i);
});

// --- describeGap ------------------------------------------------------------

test('describeGap picks the largest whole unit that fits', () => {
  assert.equal(describeGap(5), '5 seconds');
  assert.equal(describeGap(90), '1 minute');
  assert.equal(describeGap(60 * 59), '59 minutes');
  assert.equal(describeGap(HOUR), '1 hour');
  assert.equal(describeGap(HOUR * 23), '23 hours');
  assert.equal(describeGap(HOUR * 24), '1 day');
  assert.equal(describeGap(HOUR * 72), '3 days');
});

test('describeGap singularises exactly one of each unit', () => {
  assert.equal(describeGap(1), '1 second');
  assert.equal(describeGap(60), '1 minute');
});

test('describeGap does not produce a negative age', () => {
  // Clock skew between the row and now() should read as "just now", not as
  // "-3 seconds ago".
  assert.equal(describeGap(-3), '0 seconds');
});
