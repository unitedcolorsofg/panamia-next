import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
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
