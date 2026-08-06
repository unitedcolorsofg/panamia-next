import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { and, asc, eq, isNotNull, or, sql, SQL } from 'drizzle-orm';

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

  const matches = (column: SQL<string | null> | typeof profiles.name) =>
    sql`${column} ILIKE ${contains} ESCAPE '\\'`;

  try {
    const rows = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        screenname: users.screenname,
        primaryImageCdn: profiles.primaryImageCdn,
        addressLocality: profiles.addressLocality,
        fiveWords,
      })
      .from(profiles)
      // Inner join, not left: /p/[user] resolves through users.screenname, so a
      // profile without one has nowhere for a suggestion to navigate to.
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(
        and(
          eq(profiles.active, true),
          isNotNull(users.screenname),
          or(matches(profiles.name), matches(fiveWords), matches(tags))
        )
      )
      // Name matches first, and a name that starts with the term ahead of one
      // that merely contains it — "Dan" should lead with Dana, not with a bio
      // that mentions Dan halfway through.
      .orderBy(
        sql`CASE
          WHEN ${profiles.name} ILIKE ${prefix} ESCAPE '\\' THEN 0
          WHEN ${profiles.name} ILIKE ${contains} ESCAPE '\\' THEN 1
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

export const maxDuration = 5;
