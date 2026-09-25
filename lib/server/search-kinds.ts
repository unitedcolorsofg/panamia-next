import { db } from '@/lib/db';
import { events, profiles, relayGroups, users, venues } from '@/lib/schema';
import {
  and,
  eq,
  gte,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { DIRECTORY_ACCOUNT_TYPES } from '@/lib/accounts';
import type { ScopeCounts } from '@/lib/directory-scopes';

/**
 * Full-page search for the scopes that are not the business directory.
 *
 * Three functions rather than one generic one, for the same reason
 * lib/server/suggest.ts has four queries rather than a UNION: the kinds share
 * a search box and nothing else. Different tables, different visibility rules,
 * different sort orders, and different ideas of what a result even looks like.
 *
 * The relationship to the other two search layers is worth being explicit
 * about, because there are now three and they are easy to confuse:
 *
 *   suggest.ts       ten rows, per keystroke, ILIKE, all four kinds merged.
 *   directory.ts     the business scope only, tsvector + a pile of facet
 *                    filters reconciled in memory.
 *   this file        one scope at a time, tsvector, full result set, paged.
 *
 * What this shares with directory.ts is the ranking shape, deliberately:
 * the same tsquery built across english/spanish/simple, the same
 * ts_rank_cd weights, and the same exact/prefix name boosts. A pana searching
 * "sazon" should see the same *kind* of ordering whichever scope they are in,
 * even though the rows come from different tables.
 *
 * What it does not share is the in-memory filtering. Those passes exist in
 * directory.ts to reconcile category and county columns that hold several
 * different shapes; events and groups have no such legacy, so their filters
 * stay in SQL and their pagination is a LIMIT/OFFSET rather than a slice of an
 * array that was fully loaded first.
 */

// Mirrors lib/server/directory.ts. ts_rank_cd takes weights in {D,C,B,A}
// order, so these read backwards: D is 0.1 and A is 1.0.
const RANK_WEIGHTS = '{0.1,0.3,0.6,1.0}';

// Large enough to dominate ts_rank_cd, which lands in the 0..1 range in
// practice. An exact name match is not "a very relevant result", it is the
// thing that was asked for, and no amount of term frequency should outrank it.
const EXACT_NAME_BOOST = 1000;
const PREFIX_NAME_BOOST = 100;

export const SCOPE_PAGE_SIZE = 24;

/**
 * The generated tsvector columns, referenced as raw SQL.
 *
 * They are deliberately absent from lib/schema/index.ts — profiles.search_vector
 * has been missing from it since 0040 — and that absence is load-bearing rather
 * than an oversight. Declaring a column there puts it in drizzle's default
 * projection, so every `db.query.events.findMany()` in the codebase would start
 * shipping a tsvector it has no use for. Naming the physical column here keeps
 * the cost where the benefit is.
 *
 * Safe to hardcode the table qualifier because none of the queries below alias
 * their tables; lib/server/directory.ts does the same thing with an alias.
 */
const profileVector = sql`"profiles"."search_vector"`;
const groupVector = sql`"relay_groups"."search_vector"`;
const eventVector = sql`"events"."search_vector"`;

/**
 * The tsquery every scope matches against.
 *
 * websearch_to_tsquery rather than plainto_tsquery so quoted phrases and
 * negation work the way people expect from a search box. OR'd across three
 * configurations because a term may be English, Spanish, or a proper noun
 * that no stemmer should touch — see migration 0040 for why the columns are
 * indexed the same three ways.
 */
const tsquery = (term: string) => sql`(
  websearch_to_tsquery('english', pana_unaccent(${term}))
  || websearch_to_tsquery('spanish', pana_unaccent(${term}))
  || websearch_to_tsquery('simple',  pana_unaccent(${term}))
)`;

/**
 * Rank expression shared by all three scopes.
 *
 * `nameColumn` is whatever that kind calls its title, because the boosts are
 * about the name specifically: a group called "Pana MIA Public" must lead the
 * results for "pana mia public" even if some other group's about text repeats
 * those words more often.
 */
const rankExpr = (
  vectorColumn: unknown,
  nameColumn: unknown,
  term: string
) => sql<number>`(
  ts_rank_cd(${RANK_WEIGHTS}::float4[], ${vectorColumn}, ${tsquery(term)})
  + CASE WHEN lower(pana_unaccent(${nameColumn})) = lower(pana_unaccent(${term}))
         THEN ${EXACT_NAME_BOOST} ELSE 0 END
  + CASE WHEN starts_with(lower(pana_unaccent(${nameColumn})), lower(pana_unaccent(${term})))
         THEN ${PREFIX_NAME_BOOST} ELSE 0 END
)`;

export interface ScopeResult {
  id: string;
  name: string;
  subtitle: string | null;
  href: string;
  imageUrl: string | null;
  /** Second-line metadata the card renders under the subtitle, if any. */
  meta: string | null;
}

export interface ScopeSearchResult {
  results: ScopeResult[];
  total: number;
  page: number;
  totalPages: number;
}

const empty = (page: number): ScopeSearchResult => ({
  results: [],
  total: 0,
  page,
  totalPages: 0,
});

function paginate(page: number, pageSize: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  return { page: safePage, offset: (safePage - 1) * pageSize };
}

/**
 * Panas — the members themselves.
 *
 * Signed-in only. The caller is responsible for establishing that, and passing
 * a viewer who is not signed in is a caller bug rather than something to
 * silently degrade: see the route, which redirects instead. The reasoning is
 * suggest.ts's, unchanged — `lib/accounts` keeps personal accounts out of the
 * public directory because they are people who search it rather than appear in
 * it, and a public page that enumerates the membership would undo that.
 *
 * No new index was needed here. A pana is the same `profiles` row as a
 * business with a different account type, so 0040's search_vector already
 * covers it; this is a filter relaxation, not a new corpus.
 */
export async function searchPanas(
  term: string,
  page = 1,
  pageSize = SCOPE_PAGE_SIZE
): Promise<ScopeSearchResult> {
  const trimmed = term.trim();
  const { page: safePage, offset } = paginate(page, pageSize);
  if (!trimmed) return empty(safePage);

  const handle = sql<
    string | null
  >`COALESCE(${profiles.screenname}, ${users.screenname})`;

  const where = and(
    eq(profiles.active, true),
    sql`COALESCE(${profiles.screenname}, ${users.screenname}) IS NOT NULL`,
    // Spread because DIRECTORY_ACCOUNT_TYPES is `as const` and notInArray
    // needs a mutable array of the enum's values.
    notInArray(users.accountType, [...DIRECTORY_ACCOUNT_TYPES]),
    sql`${profileVector} @@ ${tsquery(trimmed)}`
  );

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: profiles.id,
        name: profiles.name,
        screenname: handle,
        primaryImageCdn: profiles.primaryImageCdn,
        addressLocality: profiles.addressLocality,
        rank: rankExpr(profileVector, profiles.name, trimmed),
      })
      .from(profiles)
      // Inner, unlike the business search: a pana is defined by the account,
      // so a profile row with no user is by definition not one.
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(where)
      .orderBy(
        sql`${rankExpr(profileVector, profiles.name, trimmed)} DESC`,
        profiles.name
      )
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(where),
  ]);

  const total = totals[0]?.count ?? 0;
  return {
    results: rows.map((row) => ({
      id: row.id,
      name: row.name,
      // The handle rather than the city, matching the typeahead: two members
      // can share a display name, but not a handle.
      subtitle: row.screenname ? `@${row.screenname}` : null,
      href: `/p/${row.screenname}`,
      imageUrl: row.primaryImageCdn,
      meta: row.addressLocality,
    })),
    total,
    page: safePage,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Relay groups.
 *
 * Signed-in only and discoverable-only, for the two independent reasons
 * suggest.ts sets out: every /api/relay/groups route answers 401 to an
 * anonymous caller, and `discoverable` is derived from an open join policy, so
 * an invite-only group's existence is not advertised anywhere else in the
 * product. Belonging to one can be sensitive by itself.
 */
export async function searchGroups(
  term: string,
  page = 1,
  pageSize = SCOPE_PAGE_SIZE
): Promise<ScopeSearchResult> {
  const trimmed = term.trim();
  const { page: safePage, offset } = paginate(page, pageSize);
  if (!trimmed) return empty(safePage);

  const where = and(
    eq(relayGroups.discoverable, true),
    sql`${groupVector} @@ ${tsquery(trimmed)}`
  );

  const [rows, totals] = await Promise.all([
    db
      .select({
        groupId: relayGroups.groupId,
        name: relayGroups.name,
        about: relayGroups.about,
        picture: relayGroups.picture,
        rank: rankExpr(groupVector, relayGroups.name, trimmed),
      })
      .from(relayGroups)
      .where(where)
      .orderBy(
        sql`${rankExpr(groupVector, relayGroups.name, trimmed)} DESC`,
        relayGroups.name
      )
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(relayGroups)
      .where(where),
  ]);

  const total = totals[0]?.count ?? 0;
  return {
    results: rows.map((row) => ({
      id: row.groupId,
      name: row.name,
      subtitle: row.about,
      href: `/r/groups/${row.groupId}`,
      imageUrl: row.picture,
      meta: null,
    })),
    total,
    page: safePage,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Upcoming events.
 *
 * Public, filtered to exactly what /e/[slug] shows a stranger: published,
 * public — not unlisted, whose whole point is to be reachable only by someone
 * holding the link — and not already over.
 *
 * Sorted by date, not by rank, and that is the one place this scope
 * deliberately departs from the others. Among events that all match the term,
 * the soonest is nearly always the one meant; "which Saturday market" is a
 * question about the next one. Rank still decides *membership* in the result
 * set, it just doesn't decide the order within it.
 */
export async function searchEvents(
  term: string,
  page = 1,
  pageSize = SCOPE_PAGE_SIZE
): Promise<ScopeSearchResult> {
  const trimmed = term.trim();
  const { page: safePage, offset } = paginate(page, pageSize);
  if (!trimmed) return empty(safePage);

  const where = and(
    eq(events.status, 'published'),
    eq(events.visibility, 'public'),
    gte(events.startsAt, new Date()),
    sql`${eventVector} @@ ${tsquery(trimmed)}`
  );

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: events.id,
        slug: events.slug,
        title: events.title,
        coverImage: events.coverImage,
        startsAt: events.startsAt,
        timezone: events.timezone,
        mode: events.mode,
        venueCity: venues.city,
      })
      .from(events)
      // Left: online-only events have no venue row, and an inner join would
      // hide an entire event mode from search.
      .leftJoin(venues, eq(venues.id, events.venueId))
      .where(where)
      .orderBy(events.startsAt)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .leftJoin(venues, eq(venues.id, events.venueId))
      .where(where),
  ]);

  const total = totals[0]?.count ?? 0;
  return {
    results: rows.map((row) => ({
      id: row.id,
      name: row.title,
      subtitle: formatEventWhen(row.startsAt, row.timezone),
      href: `/e/${row.slug}`,
      imageUrl: row.coverImage,
      meta: row.mode === 'online' ? 'Online' : row.venueCity,
    })),
    total,
    page: safePage,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * How soon an event is, in the event's own timezone.
 *
 * Same reasoning as suggest.ts's copy: an event in Miami is on the day Miami
 * says it is, regardless of where it is being searched from, and this renders
 * on the server so it cannot depend on the reader's clock.
 */
function formatEventWhen(startsAt: Date, timezone: string): string | null {
  if (Number.isNaN(startsAt.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    }).format(startsAt);
  } catch {
    // An invalid tz in one row must not take the whole page down with it.
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(startsAt);
  }
}

/**
 * Businesses, as plain ranked rows.
 *
 * Deliberately *not* the function behind /directory/search. That page is the
 * directory proper: county and category facets, a map, distance sorting, the
 * whole apparatus in getSearch(). This is the stripped-down version the
 * "Everything" scope needs, where businesses are one of four short lists and
 * none of that apparatus has anywhere to live.
 *
 * Having two is the honest outcome. Threading an "omit the facets" flag
 * through getSearch() would make the directory's main query answer to a
 * caller that wants none of what it does.
 *
 * The visibility predicate, though, is copied from getSearch() exactly and has
 * to stay copied: active, reachable at a handle, and not a personal account.
 * If that one changes, this must too.
 */
export async function searchBusinesses(
  term: string,
  page = 1,
  pageSize = SCOPE_PAGE_SIZE
): Promise<ScopeSearchResult> {
  const trimmed = term.trim();
  const { page: safePage, offset } = paginate(page, pageSize);
  if (!trimmed) return empty(safePage);

  const handle = sql<string>`COALESCE(${profiles.screenname}, ${users.screenname})`;
  const fiveWords = sql<string | null>`${profiles.descriptions}->>'fiveWords'`;

  const where = and(
    eq(profiles.active, true),
    sql`COALESCE(${profiles.screenname}, ${users.screenname}) IS NOT NULL`,
    or(isNull(profiles.userId), inArray(users.accountType, DIRECTORY_ACCOUNT_TYPES)),
    sql`${profileVector} @@ ${tsquery(trimmed)}`
  );

  const ranking = rankExpr(profileVector, profiles.name, trimmed);

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: profiles.id,
        name: profiles.name,
        handle,
        fiveWords,
        addressLocality: profiles.addressLocality,
        primaryImageCdn: profiles.primaryImageCdn,
      })
      .from(profiles)
      // Left, not inner: an unclaimed listing keeps profiles.userId NULL
      // permanently, and an inner join would drop the directory's main
      // content type before any filter above runs.
      .leftJoin(users, eq(profiles.userId, users.id))
      .where(where)
      .orderBy(sql`${ranking} DESC`, profiles.name)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles)
      .leftJoin(users, eq(profiles.userId, users.id))
      .where(where),
  ]);

  const total = totals[0]?.count ?? 0;
  return {
    results: rows.map((row) => ({
      id: row.id,
      name: row.name,
      subtitle: row.fiveWords,
      href: `/p/${row.handle}`,
      imageUrl: row.primaryImageCdn,
      meta: row.addressLocality,
    })),
    total,
    page: safePage,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Businesses that match, counted but not fetched.
 *
 * Used only to label the business tab from a non-business scope, so the count
 * is honest about what pressing it will show. Mirrors getSearch()'s account
 * type predicate exactly; if that one changes, this must too.
 */
export async function countBusinesses(term: string): Promise<number> {
  const trimmed = term.trim();
  if (!trimmed) return 0;

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profiles)
    .where(
      and(
        eq(profiles.active, true),
        or(
          // Unclaimed legacy listings predate accounts entirely — no user row
          // to carry an account type, but listings by definition.
          isNull(profiles.userId),
          inArray(
            profiles.userId,
            db
              .select({ id: users.id })
              .from(users)
              .where(inArray(users.accountType, DIRECTORY_ACCOUNT_TYPES))
          )
        ),
        sql`${profileVector} @@ ${tsquery(trimmed)}`
      )
    );

  return rows[0]?.count ?? 0;
}

/** Count panas matching, for the scope tab label. Signed-in callers only. */
export async function countPanas(term: string): Promise<number> {
  const trimmed = term.trim();
  if (!trimmed) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(
      and(
        eq(profiles.active, true),
        sql`COALESCE(${profiles.screenname}, ${users.screenname}) IS NOT NULL`,
        notInArray(users.accountType, [...DIRECTORY_ACCOUNT_TYPES]),
        sql`${profileVector} @@ ${tsquery(trimmed)}`
      )
    );
  return rows[0]?.count ?? 0;
}

/** Count discoverable groups matching, for the scope tab label. */
export async function countGroups(term: string): Promise<number> {
  const trimmed = term.trim();
  if (!trimmed) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(relayGroups)
    .where(
      and(
        eq(relayGroups.discoverable, true),
        sql`${groupVector} @@ ${tsquery(trimmed)}`
      )
    );
  return rows[0]?.count ?? 0;
}

/** Count upcoming public events matching, for the scope tab label. */
export async function countEvents(term: string): Promise<number> {
  const trimmed = term.trim();
  if (!trimmed) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.status, 'published'),
        eq(events.visibility, 'public'),
        gte(events.startsAt, new Date()),
        sql`${eventVector} @@ ${tsquery(trimmed)}`
      )
    );
  return rows[0]?.count ?? 0;
}

/**
 * Every scope's result count for one term, for the scope bar.
 *
 * Runs the four counts concurrently. `viewerIsSignedIn` is the only access
 * input, exactly as in getSuggestions: the members-only scopes report zero to
 * an anonymous visitor rather than a real count, because the count itself
 * leaks how many members match a name.
 *
 * Keyed by scope rather than by table so the bar can index it with the scope
 * it is rendering, and there is one vocabulary — `pana`, not `panas` here and
 * `pana` there — across the route, the chips and the menu.
 */
export async function countAllScopes(
  term: string,
  viewerIsSignedIn: boolean
): Promise<ScopeCounts> {
  const [business, pana, group, event] = await Promise.all([
    countBusinesses(term),
    viewerIsSignedIn ? countPanas(term) : Promise.resolve(0),
    viewerIsSignedIn ? countGroups(term) : Promise.resolve(0),
    countEvents(term),
  ]);
  return { business, pana, group, event };
}
