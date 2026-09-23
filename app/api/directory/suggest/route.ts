import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { and, asc, eq, inArray, isNull, or, sql, SQL } from 'drizzle-orm';
import { DIRECTORY_ACCOUNT_TYPES } from '@/lib/accounts';

/**
 * Directory autocomplete — the typeahead behind the search box.
 *
 * Deliberately not `getSearch()`: that one loads every active profile and
 * filters in JS, which is fine for a single submit but not for a request per
 * keystroke. This selects only the columns a suggestion row renders, pushes
 * the match into SQL, and caps the result set.
 */

// Enough rows to be useful, few enough to scan without scrolling.
const SUGGEST_LIMIT = 8;

// Below this, near enough every profile matches and the list is noise.
const MIN_TERM_LENGTH = 2;

// Long terms are always someone pasting; nothing past this narrows anything.
const MAX_TERM_LENGTH = 100;

/**
 * Escape a user term for use inside a LIKE pattern.
 *
 * The term is bound as a parameter, so it can't inject SQL — but LIKE still
 * interprets `%` and `_` inside the bound value, so a search for "50_50" would
 * silently match "5000". Paired with an explicit ESCAPE clause below.
 */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Why every comparison below is wrapped in pana_unaccent().
 *
 * ILIKE folds case but not diacritics, so `'Taller Lucía' ILIKE '%lucia%'` is
 * false. A member typing on a US keyboard — which is most of them, most of the
 * time — got an empty typeahead for any business whose name carries an accent,
 * while pressing Enter found it, because getSearch() unaccents both sides.
 * Miami's directory is full of these: Café, Bodegón, Peluquería, Lucía, José.
 *
 * Unaccenting both sides rather than just the column is deliberate, and is
 * what getSearch() does. Column-only would fix "lucia" -> "Lucía" but break
 * the mirror case, where someone typing "Lucía" on a Spanish keyboard or a
 * phone misses a listing stored without the accent.
 *
 * It also aligns the name predicate with the index built for this very query
 * shape: 0041_profile_name_trigram.sql creates a GIN gin_trgm_ops index on
 * pana_unaccent(name) so an `ILIKE '%term%'` on a name can use it, and that
 * migration warns the query must filter on the same expression the index
 * stores or the index is dead weight. The bare column could never have.
 *
 * Measured rather than assumed, and the alignment alone does not buy the
 * scan. Given the name predicate on its own the planner does choose
 * profiles_name_trgm_idx (confirmed with enable_seqscan=off; on a small table
 * it costs out a seq scan first). In the OR'd shape this route actually
 * issues it bitmap-scans profiles_active_idx and applies all three ILIKEs as
 * a filter, because the two jsonb expressions have no index to OR against.
 * So this makes the name predicate indexable, not indexed. That is worth
 * having as the table grows, or if those jsonb columns are ever indexed, but
 * it is not a performance fix today and shouldn't be cited as one.
 *
 * pana_unaccent is STRICT, so a null descriptions field still yields null and
 * is still excluded, exactly as the bare column was. It is also IMMUTABLE
 * (0040) — the wrapper exists because unaccent() itself is only STABLE.
 */

export async function GET(request: NextRequest) {
  const searchParams = (request.nextUrl ?? new URL(request.url)).searchParams;
  const term = (searchParams.get('q') || '').trim().slice(0, MAX_TERM_LENGTH);

  if (term.length < MIN_TERM_LENGTH) {
    return NextResponse.json({ success: true, data: [] });
  }

  // Public, anonymous data keyed entirely by the term — same edge-cache
  // treatment as /api/getDirectorySearch.
  const cacheHeaders = {
    'Cache-Control':
      'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
  };

  const escaped = escapeLike(term);
  const contains = `%${escaped}%`;
  const prefix = `${escaped}%`;

  // `descriptions` is jsonb, so the searchable text comes out via ->>.
  const fiveWords = sql<string | null>`${profiles.descriptions}->>'fiveWords'`;
  const tags = sql<string | null>`${profiles.descriptions}->>'tags'`;

  // /p/[handle] resolves the profile's own screenname first and falls back to
  // its owner's, the same order lib/server/directory.ts uses. A business
  // listing carries its handle here because it has no user row to carry one.
  const handle = sql<
    string | null
  >`COALESCE(${profiles.screenname}, ${users.screenname})`;

  const matches = (column: SQL<string | null> | typeof profiles.name) =>
    sql`pana_unaccent(${column}) ILIKE pana_unaccent(${contains}) ESCAPE '\\'`;

  try {
    const rows = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        screenname: handle,
        primaryImageCdn: profiles.primaryImageCdn,
        addressLocality: profiles.addressLocality,
        fiveWords,
      })
      .from(profiles)
      // Left, not inner: a business listing submitted through
      // /form/list-your-business keeps profiles.userId NULL permanently and is
      // administered through profileOwners, so an inner join drops the
      // directory's main content type before any filter below runs.
      .leftJoin(users, eq(profiles.userId, users.id))
      .where(
        and(
          // Also the gate on unapproved submissions: intake writes
          // active: false, so nothing reaches the typeahead until it is live.
          eq(profiles.active, true),
          // A suggestion navigates to /p/[handle], so a profile with no handle
          // on either side has nowhere to go.
          sql`COALESCE(${profiles.screenname}, ${users.screenname}) IS NOT NULL`,
          // Personal accounts search the directory; they don't appear in it. A
          // listing with no user carries no account type to test and is a
          // listing by definition — the same reasoning getSearch() applies.
          or(
            isNull(profiles.userId),
            inArray(users.accountType, DIRECTORY_ACCOUNT_TYPES)
          ),
          or(matches(profiles.name), matches(fiveWords), matches(tags))
        )
      )
      // Name matches first, and a name that starts with the term ahead of one
      // that merely contains it — "Dan" should lead with Dana, not with a bio
      // that mentions Dan halfway through. Unaccented for the same reason as
      // the filter: otherwise "lucia" would match Taller Lucía in the WHERE
      // and then rank it below every bio mention, which reads as a worse bug
      // than not finding it.
      .orderBy(
        sql`CASE
          WHEN pana_unaccent(${profiles.name}) ILIKE pana_unaccent(${prefix}) ESCAPE '\\' THEN 0
          WHEN pana_unaccent(${profiles.name}) ILIKE pana_unaccent(${contains}) ESCAPE '\\' THEN 1
          ELSE 2
        END`,
        asc(profiles.name)
      )
      .limit(SUGGEST_LIMIT);

    return NextResponse.json(
      { success: true, data: rows },
      { headers: cacheHeaders }
    );
  } catch (error) {
    console.error('Directory suggest error:', error);
    // A dead typeahead should not break the search box it sits under, so this
    // reads as "no suggestions" to the client rather than as a failure.
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
