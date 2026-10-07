import { searchPath } from '@/lib/directory-search-path';
import { SUGGESTION_KINDS, type SuggestionKind } from '@/lib/suggest';

/**
 * The scopes a directory search can be pointed at.
 *
 * "Everything" first, then the four kinds in the order the typeahead already
 * interleaves them, so the menu and the suggestion list agree about what comes
 * before what.
 *
 * Kept free of server and React imports: the scope bar is a client component,
 * the routes are server components, and both need this.
 */
export const SCOPES = ['all', ...SUGGESTION_KINDS] as const;
export type Scope = (typeof SCOPES)[number];

/**
 * The URL segment each scope lives under.
 *
 * The directory is the exception and deliberately so: it keeps
 * /directory/search, the route that has always been the directory, because it
 * carries the map, the county and category facets and every inbound link the
 * product has ever published. Moving it to /directory/listings for tidiness
 * would break all of that to make a table symmetrical.
 *
 * The other three are new, so they get the readable plural. Dedicated routes
 * rather than /directory/search?kind=events because these are four different
 * pages with four different titles that should be indexed, shared and linked
 * independently -- a query param is a filter, and this is not a filter.
 */
const SCOPE_SEGMENT: Record<Exclude<Scope, 'directory'>, string> = {
  all: 'all',
  pana: 'panas',
  group: 'groups',
  event: 'events',
};

/** Reverse of SCOPE_SEGMENT, for resolving a [scope] route param. */
const SEGMENT_SCOPE: Record<string, Scope> = Object.fromEntries(
  Object.entries(SCOPE_SEGMENT).map(([scope, segment]) => [segment, scope])
) as Record<string, Scope>;

/**
 * Resolve a URL segment to a scope, or null if it isn't one.
 *
 * Returns null rather than falling back to a default so the route can answer
 * 404. /directory/panaz is a typo or a probe, and silently serving panas for
 * it would put a working page at an unbounded number of URLs.
 */
export function scopeFromSegment(segment: string): Scope | null {
  return SEGMENT_SCOPE[segment] ?? null;
}

/**
 * Where a search for `term` in `scope` lives.
 *
 * Delegates to searchPath for the directory so the canonical listing URL is
 * built in exactly one place, and mirrors its encode-and-fall-back-to-browse
 * behaviour for the rest.
 */
export function scopePath(scope: Scope, term: string): string {
  if (scope === 'directory') return searchPath(term);

  const segment = SCOPE_SEGMENT[scope];
  const trimmed = term.trim();
  return trimmed
    ? `/directory/${segment}/${encodeURIComponent(trimmed)}`
    : `/directory/${segment}`;
}

export const SCOPE_LABEL: Record<Scope, string> = {
  all: 'Everything',
  directory: 'Directory',
  pana: 'Panas',
  group: 'Groups',
  event: 'Events',
};

/**
 * What each scope actually searches, in the menu's own words.
 *
 * The labels are nouns and nouns are ambiguous here -- "Groups" could
 * plausibly mean listings with several locations, and "Panas" means nothing
 * at all on a first visit. One line of plain description is the difference
 * between a menu you read and a menu you guess at.
 *
 * The directory blurb names four kinds of thing on purpose. "Businesses" was
 * doing that work before and doing it too narrowly: the bands, co-ops and
 * non-profits already listed could not see themselves in the word, so the
 * description has to carry the breadth the label no longer spells out.
 */
export const SCOPE_BLURB: Record<Scope, string> = {
  all: 'A few of each kind, then go deeper',
  directory: 'Shops, makers, bands, co-ops and non-profits',
  pana: 'Members by name or handle',
  group: 'Chat groups on the relay',
  event: 'Shows, markets and meetups',
};

/**
 * Scopes only offered to signed-in visitors.
 *
 * Mirrors lib/server/suggest.ts exactly, and must keep mirroring it: panas and
 * groups are members-only there for reasons set out at length in that file,
 * and a menu that offered them to an anonymous visitor would be advertising a
 * page that answers nothing.
 */
export const SCOPE_REQUIRES_PANA: Record<Scope, boolean> = {
  all: false,
  directory: false,
  pana: true,
  group: true,
  event: false,
};

/**
 * A colour token per scope, from the `[data-tone]` set in app/globals.css that
 * the panaverse switcher already uses.
 *
 * The dropdown, the row icon and the active chip all read from this one map,
 * so a kind cannot be burnt orange in the menu and blue in the results. `all`
 * takes indigo because indigo is the brand default, and "everything" should
 * look like the house rather than a fifth category competing with the rest.
 */
export const SCOPE_TONE: Record<Scope, string> = {
  all: 'indigo',
  directory: 'burnt',
  pana: 'blue',
  group: 'flame',
  event: 'red',
};

/**
 * Which scopes a given viewer may choose.
 *
 * The single place the members-only rule is applied to a list of scopes, so
 * the menu, the chips and the route guard cannot drift apart.
 */
export function visibleScopes(viewerIsSignedIn: boolean): Scope[] {
  return SCOPES.filter(
    (scope) => viewerIsSignedIn || !SCOPE_REQUIRES_PANA[scope]
  );
}

/** The scope a bare search lands in when nobody has chosen one. */
export const DEFAULT_SCOPE: Scope = 'directory';

export type ScopeCounts = Record<Exclude<Scope, 'all'>, number>;

/** All zeroes — what a caller shows when counts are unknown or failed. */
export const EMPTY_SCOPE_COUNTS: ScopeCounts = {
  directory: 0,
  pana: 0,
  group: 0,
  event: 0,
};

/** Total across the four kinds, for the "Everything" label. */
export function totalCount(counts: ScopeCounts): number {
  return counts.directory + counts.pana + counts.group + counts.event;
}

export function countFor(counts: ScopeCounts, scope: Scope): number {
  return scope === 'all' ? totalCount(counts) : counts[scope];
}

/** Maps a scope to the suggestion kind it filters to, if it filters at all. */
export function scopeKind(scope: Scope): SuggestionKind | null {
  return scope === 'all' ? null : scope;
}
