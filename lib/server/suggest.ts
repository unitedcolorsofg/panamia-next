import { db } from '@/lib/db';
import { events, profiles, relayGroups, users, venues } from '@/lib/schema';
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { DIRECTORY_ACCOUNT_TYPES } from '@/lib/accounts';
import {
  SUGGEST_LIMIT,
  SUGGESTION_KINDS,
  type Suggestion,
  type SuggestionKind,
} from '@/lib/suggest';

/**
 * Search autocomplete — the typeahead behind the search box.
 *
 * Deliberately not `getSearch()`: that one loads every active profile and
 * filters in JS, which is fine for a single submit but not for a request per
 * keystroke. Each query below selects only the columns a suggestion row
 * renders, pushes the match into SQL, and caps its own result set.
 *
 * Four kinds come back through one list. They are fetched independently and
 * merged in `mergeSuggestions`, rather than UNION'd, because the kinds have
 * almost nothing in common at the SQL level: different tables, different
 * visibility rules, different notions of "matches", and — for events — a sort
 * by date rather than by name.
 */

// Enough of each kind that a lopsided term still fills the list from one
// source, while the merge below is what decides the actual mix.
const PER_KIND_LIMIT = SUGGEST_LIMIT;

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
 * It also aligns the profile name predicate with the index built for this very
 * query shape: 0041_profile_name_trigram.sql creates a GIN gin_trgm_ops index
 * on pana_unaccent(name) so an `ILIKE '%term%'` on a name can use it, and that
 * migration warns the query must filter on the same expression the index
 * stores or the index is dead weight. The bare column could never have.
 *
 * Measured rather than assumed, and the alignment alone does not buy the
 * scan. Given the name predicate on its own the planner does choose
 * profiles_name_trgm_idx (confirmed with enable_seqscan=off; on a small table
 * it costs out a seq scan first). In the OR'd shape the business query
 * actually issues it bitmap-scans profiles_active_idx and applies all three
 * ILIKEs as a filter, because the two jsonb expressions have no index to OR
 * against. So this makes the name predicate indexable, not indexed. That is
 * worth having as the table grows, or if those jsonb columns are ever indexed,
 * but it is not a performance fix today and shouldn't be cited as one.
 *
 * The events and groups tables have no such index, and deliberately get none
 * here: both are small enough that a sequential scan of a name column costs
 * less than the write amplification an index would add. Revisit if either
 * grows by an order of magnitude.
 *
 * pana_unaccent is STRICT, so a null `about` or description still yields null
 * and is still excluded, exactly as the bare column was. It is also IMMUTABLE
 * (0040) — the wrapper exists because unaccent() itself is only STABLE.
 */
function patterns(term: string) {
  const escaped = escapeLike(term);
  return { contains: `%${escaped}%`, prefix: `${escaped}%` };
}

const like = (column: unknown, pattern: string) =>
  sql`pana_unaccent(${column}) ILIKE pana_unaccent(${pattern}) ESCAPE '\\'`;

/**
 * Name matches first, and a name that starts with the term ahead of one that
 * merely contains it — "Dan" should lead with Dana, not with a bio that
 * mentions Dan halfway through. Unaccented for the same reason as the filter:
 * otherwise "lucia" would match Taller Lucía in the WHERE and then rank it
 * below every bio mention, which reads as a worse bug than not finding it.
 */
const nameRank = (column: unknown, term: string) => {
  const { contains, prefix } = patterns(term);
  return sql`CASE
    WHEN pana_unaccent(${column}) ILIKE pana_unaccent(${prefix}) ESCAPE '\\' THEN 0
    WHEN pana_unaccent(${column}) ILIKE pana_unaccent(${contains}) ESCAPE '\\' THEN 1
    ELSE 2
  END`;
};

// /p/[handle] resolves the profile's own screenname first and falls back to
// its owner's, the same order lib/server/directory.ts uses. A business listing
// carries its handle here because it has no user row to carry one.
const handle = sql<
  string | null
>`COALESCE(${profiles.screenname}, ${users.screenname})`;

/**
 * Businesses and other directory listings.
 *
 * Public: this is the directory, and the directory is the thing anonymous
 * visitors come to browse.
 */
async function suggestBusinesses(term: string): Promise<Suggestion[]> {
  const { contains } = patterns(term);

  // `descriptions` is jsonb, so the searchable text comes out via ->>.
  const fiveWords = sql<string | null>`${profiles.descriptions}->>'fiveWords'`;
  const tags = sql<string | null>`${profiles.descriptions}->>'tags'`;

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
        // Personal accounts are panas, and are suggested as panas below — to
        // signed-in visitors only. A listing with no user carries no account
        // type to test and is a listing by definition, the same reasoning
        // getSearch() applies.
        or(
          isNull(profiles.userId),
          inArray(users.accountType, DIRECTORY_ACCOUNT_TYPES)
        ),
        or(
          like(profiles.name, contains),
          like(fiveWords, contains),
          like(tags, contains)
        )
      )
    )
    .orderBy(nameRank(profiles.name, term), asc(profiles.name))
    .limit(PER_KIND_LIMIT);

  return rows.map((row) => ({
    kind: 'business' as const,
    id: row.id,
    name: row.name,
    subtitle:
      [row.fiveWords, row.addressLocality].filter(Boolean).join(' · ') || null,
    href: `/p/${row.screenname}`,
    imageUrl: row.primaryImageCdn,
  }));
}

/**
 * Panas — the members themselves.
 *
 * Signed-in only, and that gate is the whole reason this is a separate query
 * from the businesses above rather than a relaxed filter on it. `lib/accounts`
 * keeps personal accounts out of the public directory on the grounds that they
 * are people who search it rather than appear in it, and an anonymous
 * typeahead that enumerates the membership would undo that in the one place
 * nobody would think to look. Every pana is discoverable — to another pana.
 *
 * Every signed-in member has a profile row (see
 * app/api/user/screenname/set/route.ts) created active with a handle, so the
 * only rows this drops are accounts that never finished picking a screenname
 * and therefore have no /p page to send anyone to.
 */
async function suggestPanas(term: string): Promise<Suggestion[]> {
  const { contains } = patterns(term);

  const rows = await db
    .select({
      id: profiles.id,
      name: profiles.name,
      screenname: handle,
      primaryImageCdn: profiles.primaryImageCdn,
      addressLocality: profiles.addressLocality,
    })
    .from(profiles)
    // Inner, unlike the business query: a pana is defined by the account, so a
    // row with no user is by definition not one.
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(
      and(
        eq(profiles.active, true),
        sql`COALESCE(${profiles.screenname}, ${users.screenname}) IS NOT NULL`,
        // Spread because DIRECTORY_ACCOUNT_TYPES is `as const`, and
        // notInArray only accepts a mutable array of the enum's values.
        notInArray(users.accountType, [...DIRECTORY_ACCOUNT_TYPES]),
        or(
          like(profiles.name, contains),
          like(profiles.screenname, contains),
          like(users.screenname, contains)
        )
      )
    )
    .orderBy(nameRank(profiles.name, term), asc(profiles.name))
    .limit(PER_KIND_LIMIT);

  return rows.map((row) => ({
    kind: 'pana' as const,
    id: row.id,
    // The handle rather than the city: a directory listing is a place you go
    // and a pana is an account you follow, so the identifier is the useful
    // second line. Two members can share a display name; they cannot share a
    // handle.
    subtitle: row.screenname ? `@${row.screenname}` : null,
    name: row.name,
    href: `/p/${row.screenname}`,
    imageUrl: row.primaryImageCdn,
  }));
}

/**
 * Relay groups.
 *
 * Signed-in only, and discoverable-only within that. Two separate reasons,
 * either of which would be sufficient:
 *
 *   - Every /api/relay/groups route answers 401 to an anonymous caller and
 *     /r/groups is a signed-in surface, so an anonymous suggestion would be an
 *     offer the destination refuses.
 *   - `discoverable` is derived from an open join policy, and an invite-only
 *     group's existence is not advertised anywhere else in the product. See
 *     listPublicGroupsForPubkey in lib/server/relay-groups.ts, which reaches
 *     the same conclusion for the same reason: belonging to one can be
 *     sensitive by itself, independently of anything said inside it.
 *
 * The consequence is that a member does not find their own invite-only group
 * here. That is the right trade for a shared search box — the group is one
 * click away under /r/groups, which is the surface that knows who is asking.
 */
async function suggestGroups(term: string): Promise<Suggestion[]> {
  const { contains } = patterns(term);

  const rows = await db
    .select({
      groupId: relayGroups.groupId,
      name: relayGroups.name,
      about: relayGroups.about,
      picture: relayGroups.picture,
    })
    .from(relayGroups)
    .where(
      and(
        eq(relayGroups.discoverable, true),
        or(like(relayGroups.name, contains), like(relayGroups.about, contains))
      )
    )
    .orderBy(nameRank(relayGroups.name, term), asc(relayGroups.name))
    .limit(PER_KIND_LIMIT);

  return rows.map((row) => ({
    kind: 'group' as const,
    id: row.groupId,
    name: row.name,
    subtitle: row.about,
    href: `/r/groups/${row.groupId}`,
    imageUrl: row.picture,
  }));
}

/**
 * How soon an event is, in the words someone would use.
 *
 * Mirrors formatWhen in app/directory/search/_lib/format.ts, but computed on
 * the server and in the event's own timezone: a suggestion row is rendered
 * from a cacheable API response, so it cannot depend on the reader's clock the
 * way a client component can, and an event in Miami is on the day Miami says
 * it is regardless of where it is being searched from.
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
    // An invalid tz in the row must not take the whole typeahead down with it.
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(startsAt);
  }
}

/**
 * Upcoming events.
 *
 * Public, matching /e/[slug] itself, and filtered to exactly what that page
 * shows a stranger: published, public — not unlisted, whose whole point is to
 * be reachable only by someone holding the link — and not already over. Past
 * events are dropped rather than ranked low: "which Saturday market" is a
 * question about the next one, and a suggestion you cannot attend is noise.
 *
 * Sorted by date rather than by name, because among events that all match the
 * term the soonest is nearly always the one meant.
 */
async function suggestEvents(term: string): Promise<Suggestion[]> {
  const { contains } = patterns(term);

  const rows = await db
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
    // Left: online-only events have no venue row, and dropping them would hide
    // an entire event mode from search.
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(
      and(
        eq(events.status, 'published'),
        eq(events.visibility, 'public'),
        gte(events.startsAt, new Date()),
        or(like(events.title, contains), like(events.description, contains))
      )
    )
    .orderBy(asc(events.startsAt))
    .limit(PER_KIND_LIMIT);

  return rows.map((row) => {
    const when = formatEventWhen(row.startsAt, row.timezone);
    const where = row.mode === 'online' ? 'Online' : row.venueCity;
    return {
      kind: 'event' as const,
      id: row.id,
      name: row.title,
      subtitle: [when, where].filter(Boolean).join(' · ') || null,
      href: `/e/${row.slug}`,
      imageUrl: row.coverImage,
    };
  });
}

/**
 * Interleave the kinds into one capped list.
 *
 * Round-robin rather than concatenate-and-truncate. Concatenation makes the
 * list a function of whichever kind happens to be listed first: a term like
 * "market" matches a dozen businesses, and ten of them would fill every slot
 * and hide the market *event* this Saturday, which is very likely what was
 * meant. Taking one from each kind in turn guarantees that every kind with a
 * match is represented before any kind gets a second row, and self-balances
 * when a kind has few or no matches — its turn is simply skipped and the slot
 * goes to whoever is next.
 *
 * Within a kind the order the query returned is preserved, so position 0 of
 * each kind is still that kind's best match.
 */
export function mergeSuggestions(
  byKind: Record<SuggestionKind, Suggestion[]>,
  limit = SUGGEST_LIMIT
): Suggestion[] {
  const merged: Suggestion[] = [];
  const depth = Math.max(...SUGGESTION_KINDS.map((k) => byKind[k].length), 0);

  for (let round = 0; round < depth && merged.length < limit; round += 1) {
    for (const kind of SUGGESTION_KINDS) {
      if (merged.length >= limit) break;
      const row = byKind[kind][round];
      if (row) merged.push(row);
    }
  }

  return merged;
}

/**
 * Every suggestion a given viewer is allowed to see, already merged and capped.
 *
 * `viewerIsSignedIn` is the only access input: panas and groups are members-
 * only, businesses and events are public. Passing false is what an anonymous
 * request gets, and is also the safe default for anything that cannot resolve
 * a session.
 */
export async function getSuggestions(
  term: string,
  { viewerIsSignedIn }: { viewerIsSignedIn: boolean }
): Promise<Suggestion[]> {
  const [businesses, panas, groups, upcoming] = await Promise.all([
    suggestBusinesses(term),
    viewerIsSignedIn ? suggestPanas(term) : Promise.resolve([]),
    viewerIsSignedIn ? suggestGroups(term) : Promise.resolve([]),
    suggestEvents(term),
  ]);

  return mergeSuggestions({
    business: businesses,
    pana: panas,
    group: groups,
    event: upcoming,
  });
}
