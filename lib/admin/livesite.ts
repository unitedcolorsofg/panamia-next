import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { PURGE_JOB } from '@/lib/jobs/ledger';
import { BUSINESS_INTAKE_SOURCE } from '@/lib/server/profile-owners';

/**
 * The numbers behind /admin/livesite.
 *
 * ## Why this is one statement and not twelve queries
 *
 * The obvious shape for a dashboard is a `Promise.all` of `count()` calls, one
 * per number. That is the wrong shape here, for a reason specific to how this
 * app reaches Postgres.
 *
 * `lib/db.ts` builds a postgres.js client per request and caps it at `max: 1`
 * on the `POSTGRES_URL` path. postgres.js queues concurrent queries onto the
 * connections it has, so at `max: 1` every `await Promise.all([...])` in this
 * codebase runs *sequentially* — the comment on the Hyperdrive branch says so
 * outright. Twelve counts would be twelve round trips, serialised, and
 * wrangler.jsonc documents production as taking the unpooled path where a
 * round trip is a full TCP + TLS + SCRAM handshake away.
 *
 * So the whole band is one statement with a subquery per number. Postgres
 * plans each independently and the page pays one round trip no matter how
 * many numbers get added later.
 *
 * There is an irony worth naming: the page whose job is to surface the
 * connection problem is the page most punished by it. That is also why this
 * is the file to revisit first if the Hyperdrive binding is ever restored —
 * not to change it, but because the reason for its shape will have gone.
 *
 * ## Why the queue predicates are duplicated rather than imported
 *
 * Each one mirrors the route that owns the queue — `/api/admin/listings` for
 * waiting listings, `/admin/contactus` for open submissions. Those routes
 * select whole rows and this needs a count, so there is no shared query to
 * call; what is shared is the *definition*, and that is the thing to keep
 * honest. Each predicate below names the route it must agree with. If one
 * moves, this number silently starts lying, which on a health dashboard is
 * worse than not showing it.
 *
 * The listings predicate is the one to be careful with. `active = false`
 * alone matches nearly every row on the table — every signed-in member has a
 * profile — so the source and decision checks are not refinements, they are
 * what makes the number mean "waiting" instead of "exists".
 */

/** A count now, the same count over the window before it. */
export interface Trend {
  current: number;
  previous: number;
}

/**
 * Describes a trend without inventing precision.
 *
 * Deliberately returns no percentage when the previous window was zero: the
 * first week of anything would read as an infinite rise, and "up 100%" from a
 * base of one is true and useless. At the volumes this site runs at the two
 * raw numbers carry more than a ratio does.
 *
 * Lives here rather than in the page because it is a statement about `Trend`,
 * not about markup, and because the zero case is the kind of thing that wants
 * a test more than it wants a component.
 */
export function trendNote(trend: Trend, window: string): string {
  const { current, previous } = trend;
  if (previous === 0) return current === 0 ? window : `${window}, none before`;
  const delta = current - previous;
  if (delta === 0) return `${window}, level with the week before`;
  return `${window}, ${delta > 0 ? 'up' : 'down'} from ${previous}`;
}

export interface CommunitySnapshot {
  /** New accounts, last 7 days against the 7 before them. */
  signups: Trend;
  /** New profiles of any kind, same windows. */
  profiles: Trend;
  /** Published events with a start time still ahead of now. */
  upcomingEvents: number;
  /** Accounts in total, as context for the trends. */
  totalUsers: number;

  /** Things waiting on a human. Each maps to a tool on this surface. */
  queues: {
    /** Business intake applications, undecided. → /admin/listings */
    listings: number;
    /** Contact form messages still open. → /admin/contactus */
    contact: number;
    /** Relay abuse reports still open. → /admin/reports */
    reports: number;
    /** Newsletter signups nobody has acknowledged. No screen owns this yet. */
    newsletter: number;
  };
}

/**
 * Read the community band.
 *
 * Every count is scoped by `created_at` against `now()` in Postgres rather
 * than a date computed in JS. The Worker and the database agree on UTC, but
 * events written before the #328 timezone fix are stored four hours off, and
 * a boundary computed on one side of the wire is one more place for that to
 * matter. `now()` also means the window moves with the request instead of
 * with the deploy.
 */
export async function communitySnapshot(): Promise<CommunitySnapshot> {
  const [row] = (await db.execute(sql`
    SELECT
      (SELECT count(*) FROM users
        WHERE created_at >= now() - interval '7 days')::int       AS signups_current,
      (SELECT count(*) FROM users
        WHERE created_at >= now() - interval '14 days'
          AND created_at <  now() - interval '7 days')::int       AS signups_previous,

      (SELECT count(*) FROM profiles
        WHERE created_at >= now() - interval '7 days')::int       AS profiles_current,
      (SELECT count(*) FROM profiles
        WHERE created_at >= now() - interval '14 days'
          AND created_at <  now() - interval '7 days')::int       AS profiles_previous,

      -- Mirrors the public events feed: published only, still ahead of now.
      (SELECT count(*) FROM events
        WHERE status = 'published'
          AND starts_at >= now())::int                            AS upcoming_events,

      (SELECT count(*) FROM users)::int                           AS total_users,

      -- Mirrors app/api/admin/listings/route.ts. All three clauses matter:
      -- see the note at the top of this file.
      (SELECT count(*) FROM profiles
        WHERE active = false
          AND status ->> 'source' = ${BUSINESS_INTAKE_SOURCE}
          AND status ->> 'approved' IS NULL
          AND status ->> 'declined' IS NULL)::int                 AS queue_listings,

      -- Mirrors /admin/contactus and /admin/reports, which both trade on the
      -- 'open' member of their own status enum.
      (SELECT count(*) FROM contact_submissions
        WHERE status = 'open')::int                               AS queue_contact,
      (SELECT count(*) FROM relay_reports
        WHERE status = 'open')::int                               AS queue_reports,

      (SELECT count(*) FROM newsletter_signups
        WHERE acknowledged = false)::int                          AS queue_newsletter
  `)) as unknown as {
    signups_current: number;
    signups_previous: number;
    profiles_current: number;
    profiles_previous: number;
    upcoming_events: number;
    total_users: number;
    queue_listings: number;
    queue_contact: number;
    queue_reports: number;
    queue_newsletter: number;
  }[];

  return {
    signups: {
      current: row.signups_current,
      previous: row.signups_previous,
    },
    profiles: {
      current: row.profiles_current,
      previous: row.profiles_previous,
    },
    upcomingEvents: row.upcoming_events,
    totalUsers: row.total_users,
    queues: {
      listings: row.queue_listings,
      contact: row.queue_contact,
      reports: row.queue_reports,
      newsletter: row.queue_newsletter,
    },
  };
}

// =============================================================================
// Machinery -- the scheduled jobs
// =============================================================================

/**
 * How often the sweep is meant to run. Mirrors `"crons": ["10 * * * *"]` in
 * wrangler.jsonc; if that changes, these change with it.
 */
const CRON_INTERVAL_SECONDS = 60 * 60;

/**
 * How long a gap has to be before it means something.
 *
 * Two intervals, not one. A single missed run is an ordinary event -- a
 * deploy landing on the hour, a Cloudflare hiccup -- and a dashboard that
 * cries about it gets ignored on the day it is right. Two consecutive misses
 * is a pattern.
 */
const STALE_AFTER_SECONDS = 2 * CRON_INTERVAL_SECONDS;

/**
 * How long an unfinished run is given before it counts as dead.
 *
 * Cron Triggers at an hourly interval get a 15-minute CPU budget (see the
 * note in wrangler.jsonc). A run still open past that was killed; it is not
 * thinking.
 */
const IN_FLIGHT_GRACE_SECONDS = 15 * 60;

export interface JobRunSummary {
  /** The cron expression that fired it, or 'manual'. */
  trigger: string;
  startedAt: Date;
  /** Null means the run never came back. */
  finishedAt: Date | null;
  /** Null while in flight. */
  ok: boolean | null;
  errorCount: number;
  /** Measured in Postgres, not in the Worker. See the note below. */
  secondsSinceStart: number;
  /** Null when the run never finished. */
  durationSeconds: number | null;
  /** From the report blob: expired media R2 refused to delete. */
  storiesDeferred: number;
  storiesDeleted: number;
  mediaDeleted: number;
  notificationsDeleted: number;
}

export interface MachinerySnapshot {
  /** False when job_runs does not exist. See the note below. */
  migrated: boolean;
  lastRun: JobRunSummary | null;
  /** Runs started in the last 24h. On an hourly cron, 24 is the full house. */
  runs24h: number;
  /** Of those, how many reported failure. */
  failures24h: number;
  /** Runs that opened and never closed, past the grace period. */
  killed: number;
}

/** Postgres undefined_table. The one error here that is not a fault. */
function isUndefinedTable(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    String((error as { code: unknown }).code) === '42P01'
  );
}

/** Pull a non-negative integer out of the report blob, or zero. */
function reportNumber(report: unknown, key: string): number {
  if (!report || typeof report !== 'object') return 0;
  const value = (report as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/**
 * Read the machinery band.
 *
 * ## Why a missing table is a value and not an exception
 *
 * `migrated: false` is returned when job_runs is absent, rather than letting
 * the error out. Migrations have twice reached production unapplied in this
 * repo -- scripts/check-pending-migrations.ts was written because of it -- so
 * this is a state that has actually happened, not a defensive flourish.
 *
 * The consequence of not handling it is specific and bad: /admin/livesite is
 * the page somebody opens *because* the site is behaving strangely. If a
 * missing table took the whole page down, the one tool for diagnosing a
 * half-applied deploy would be the tool that a half-applied deploy breaks.
 *
 * Every other error propagates. "The database is unreachable" must not be
 * quietly rendered as "no runs yet".
 *
 * ## Why the ages are computed in Postgres
 *
 * `now() - started_at` is evaluated by the database, which is also the clock
 * that wrote `started_at`. Subtracting in the Worker would compare two
 * machines' clocks, and the whole band hinges on one subtraction: the gap
 * between now and the newest run is the primary alarm, because a cron that
 * has stopped firing writes nothing at all -- it leaves a ledger full of
 * green rows that simply stops growing.
 */
export async function machinerySnapshot(
  job: string = PURGE_JOB
): Promise<MachinerySnapshot> {
  let row: {
    runs_24h: number;
    failures_24h: number;
    killed: number;
    last_trigger: string | null;
    last_started_at: Date | null;
    last_finished_at: Date | null;
    last_ok: boolean | null;
    last_error_count: number | null;
    last_report: unknown;
    seconds_since_start: number | null;
    duration_seconds: number | null;
  };

  try {
    const rows = (await db.execute(sql`
      SELECT
        (SELECT count(*) FROM job_runs
          WHERE job = ${job}
            AND started_at >= now() - interval '24 hours')::int  AS runs_24h,

        (SELECT count(*) FROM job_runs
          WHERE job = ${job}
            AND ok = false
            AND started_at >= now() - interval '24 hours')::int   AS failures_24h,

        -- Opened and never closed, past the point where it could still be
        -- thinking. These are Workers that were killed mid-sweep.
        (SELECT count(*) FROM job_runs
          WHERE job = ${job}
            AND finished_at IS NULL
            AND started_at < now()
              - (${IN_FLIGHT_GRACE_SECONDS} || ' seconds')::interval)::int AS killed,

        l.trigger                                                 AS last_trigger,
        l.started_at                                              AS last_started_at,
        l.finished_at                                             AS last_finished_at,
        l.ok                                                      AS last_ok,
        l.error_count                                             AS last_error_count,
        l.report                                                  AS last_report,
        extract(epoch from (now() - l.started_at))::int           AS seconds_since_start,
        extract(epoch from (l.finished_at - l.started_at))::int   AS duration_seconds

      -- LEFT JOIN LATERAL so the row survives an empty ledger: the scalar
      -- subqueries above still need somewhere to land when there is no last
      -- run, and an inner join would return nothing at all.
      FROM (SELECT 1) AS one
      LEFT JOIN LATERAL (
        SELECT trigger, started_at, finished_at, ok, error_count, report
        FROM job_runs
        WHERE job = ${job}
        ORDER BY started_at DESC
        LIMIT 1
      ) l ON true
    `)) as unknown as (typeof row)[];
    row = rows[0];
  } catch (error) {
    if (isUndefinedTable(error)) {
      return {
        migrated: false,
        lastRun: null,
        runs24h: 0,
        failures24h: 0,
        killed: 0,
      };
    }
    throw error;
  }

  const lastRun: JobRunSummary | null = row.last_started_at
    ? {
        trigger: row.last_trigger ?? 'unknown',
        startedAt: new Date(row.last_started_at),
        finishedAt: row.last_finished_at
          ? new Date(row.last_finished_at)
          : null,
        ok: row.last_ok,
        errorCount: row.last_error_count ?? 0,
        secondsSinceStart: row.seconds_since_start ?? 0,
        durationSeconds: row.duration_seconds,
        storiesDeferred: reportNumber(row.last_report, 'storiesDeferred'),
        storiesDeleted: reportNumber(row.last_report, 'storiesDeleted'),
        mediaDeleted: reportNumber(row.last_report, 'mediaDeleted'),
        notificationsDeleted: reportNumber(
          row.last_report,
          'notificationsDeleted'
        ),
      }
    : null;

  return {
    migrated: true,
    lastRun,
    runs24h: row.runs_24h,
    failures24h: row.failures_24h,
    killed: row.killed,
  };
}

/**
 * Render a gap in whole units, largest that fits.
 *
 * Rounded down deliberately: "1 hour ago" for a 119-minute gap understates
 * the problem, so the floor is applied to the unit, not the value -- 119
 * minutes is "1 hour", 121 is "2 hours". Good enough for prose, and the
 * alarms are driven by the raw seconds, not by this string.
 */
export function describeGap(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  if (safe < 60) return safe === 1 ? '1 second' : `${safe} seconds`;
  const minutes = Math.floor(safe / 60);
  if (minutes < 60) return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour' : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}

export type VerdictTone = 'ok' | 'warn' | 'alarm';

export interface MachineryVerdict {
  tone: VerdictTone;
  headline: string;
  detail: string;
}

/**
 * Turn the machinery snapshot into one sentence and a tone.
 *
 * ## Why the order of these checks is the design
 *
 * They are not independent conditions ranked by severity; each one makes the
 * ones below it unreadable. A job that has stopped running cannot report that
 * it is failing, so "has it run" has to be settled before "did it work" --
 * otherwise a dead cron renders as whatever its last successful run said,
 * which is the exact failure this band exists to catch.
 *
 * Likewise a run that was killed mid-sweep is checked before plain staleness,
 * because the two look identical in the gap and need different people: one is
 * "the schedule stopped firing", the other is "the work no longer fits in the
 * budget". Collapsing them into "it has been a while" loses the distinction
 * that tells you which.
 *
 * Pure, and separate from the page, because this ordering is the part worth
 * testing -- and because the honest cases here (no ledger, nothing recorded
 * yet) are states nobody can conveniently reproduce in a browser.
 */
export function machineryVerdict(snap: MachinerySnapshot): MachineryVerdict {
  if (!snap.migrated) {
    return {
      tone: 'warn',
      headline: 'No run ledger yet',
      detail:
        'The job_runs table is missing, so nothing is recording what the ' +
        'hourly sweep does. The sweep itself is unaffected. Apply migration ' +
        '0063 with npx drizzle-kit migrate.',
    };
  }

  const last = snap.lastRun;

  if (!last) {
    return {
      tone: 'warn',
      headline: 'Nothing recorded yet',
      detail:
        'The ledger is empty. The sweep runs at ten past the hour, so the ' +
        'first entry should appear within the hour of this going live.',
    };
  }

  const age = describeGap(last.secondsSinceStart);

  if (last.finishedAt === null) {
    if (last.secondsSinceStart > IN_FLIGHT_GRACE_SECONDS) {
      return {
        tone: 'alarm',
        headline: 'A run stopped mid-sweep',
        detail:
          `Started ${age} ago and never finished. The Worker was killed ` +
          'before it could report -- usually the CPU budget, which is 15 ' +
          'minutes at an hourly interval. Expired media is not being ' +
          'reclaimed while this persists.',
      };
    }
    return {
      tone: 'ok',
      headline: 'Running now',
      detail: `Started ${age} ago, still going.`,
    };
  }

  if (last.secondsSinceStart > STALE_AFTER_SECONDS) {
    return {
      tone: 'alarm',
      headline: 'The hourly sweep has stopped',
      detail:
        `The last run was ${age} ago and it is meant to run every hour. ` +
        'Nothing will raise this as a failure, because a job that is not ' +
        'running cannot fail -- check Cron Triggers on the Worker.',
    };
  }

  if (last.ok === false) {
    return {
      tone: 'alarm',
      headline: 'The last run failed',
      detail:
        `It ran ${age} ago and reported an error. Expired stories and their ` +
        'media stay in place until a run succeeds.',
    };
  }

  if (last.storiesDeferred > 0) {
    const n = last.storiesDeferred;
    return {
      tone: 'warn',
      headline: `${n} ${n === 1 ? 'story' : 'stories'} could not be cleared`,
      detail:
        'R2 refused to delete their media, so the rows were deliberately ' +
        'left in place to retry rather than orphaning the files. It fixes ' +
        'itself if R2 recovers; a run of these is a bucket problem.',
    };
  }

  if (last.errorCount > 0) {
    const n = last.errorCount;
    return {
      tone: 'warn',
      headline: `Last run finished with ${n} ${n === 1 ? 'error' : 'errors'}`,
      detail: `It completed ${age} ago, but not everything it tried worked.`,
    };
  }

  if (snap.failures24h > 0) {
    const n = snap.failures24h;
    return {
      tone: 'warn',
      headline: 'Running again, after trouble',
      detail:
        `The last run was clean, but ${n} of the ${snap.runs24h} runs in ` +
        'the past day failed.',
    };
  }

  if (snap.killed > 0) {
    const n = snap.killed;
    return {
      tone: 'warn',
      headline: 'Earlier runs were cut short',
      detail:
        `The last run finished cleanly, but ${n} ${n === 1 ? 'run' : 'runs'} ` +
        'in the ledger opened and never closed.',
    };
  }

  return {
    tone: 'ok',
    headline: 'Running on schedule',
    detail: `Last run ${age} ago, clean. ${snap.runs24h} in the past day.`,
  };
}

