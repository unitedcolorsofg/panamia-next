import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { DIRECTORY_ACCOUNT_TYPES } from '@/lib/accounts';

/**
 * Featured Panas — the rotating profile cards on the homepage.
 *
 * Deliberately not `getSearch()`: that loads every active profile and filters
 * in JS, which is far more work than the homepage needs to render three cards.
 * This selects only the columns a card shows and caps the result set.
 *
 * "Featured" here means a rotating sample of the directory rather than an
 * editorially curated set. There is no curation column on `profiles` yet, and
 * adding one would mean the section sat empty until somebody populated it.
 * Rotation shows a different slice of the community on each cache cycle, which
 * is the behaviour the design is after.
 */

// Three across at desktop. More than one row buries everything below it.
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 12;

export async function GET(request: NextRequest) {
  const searchParams = (request.nextUrl ?? new URL(request.url)).searchParams;
  const requested = Number.parseInt(searchParams.get('limit') || '', 10);
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(requested, MAX_LIMIT)
      : DEFAULT_LIMIT;

  // Public, anonymous data. The cache window doubles as the rotation period:
  // every request inside it sees the same sample, and the sample changes when
  // the entry expires. Without it, ORDER BY RANDOM() would reshuffle the cards
  // on every navigation and make the section feel unstable.
  const cacheHeaders = {
    'Cache-Control': 'public, max-age=300, s-maxage=300',
  };

  // `descriptions` is jsonb, so the display text comes out via ->>.
  const fiveWords = sql<string | null>`${profiles.descriptions}->>'fiveWords'`;

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
      // Inner join, not left: /p/[user] resolves through users.screenname, so
      // a profile without one has nowhere for a card to link to.
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(
        and(
          eq(profiles.active, true),
          isNotNull(users.screenname),
          // A card is mostly photograph, so a profile without one would render
          // as an empty box beside two real ones.
          isNotNull(profiles.primaryImageCdn),
          // Personal accounts search the directory; they don't appear in it.
          inArray(users.accountType, DIRECTORY_ACCOUNT_TYPES)
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(limit);

    return NextResponse.json(
      { success: true, data: rows },
      { headers: cacheHeaders }
    );
  } catch (error) {
    console.error('Directory featured error:', error);
    // The homepage renders this section only when it has rows, so an empty
    // list degrades to a hidden section rather than a broken one.
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
