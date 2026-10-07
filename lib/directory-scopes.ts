import { searchPath } from '@/lib/directory-search-path';
import type { SurfaceTone } from '@/lib/panaverse/branding';
import type { SuggestionKind } from '@/lib/suggest';

/**
 * The scopes a search can be pointed at, and where each one lands.
 *
 * This file used to describe four spellings of one results page. It now
 * describes four different products, and that is the change: the scope control
 * moved out of the directory and into the club's front door, so picking
 * "Events" is no longer narrowing a list -- it is leaving the directory for a
 * page with a calendar and an RSVP button.
 *
 * Kept free of server and React imports: the scope bar is a client component,
 * the routes are server components, and both need this.
 */

/**
 * The four kinds, in menu order, with no "Everything".
 *
 * Everything led the old bar while a bare search landed in the directory,
 * which was two defaults disagreeing: the menu said the box searched all four,
 * the submit said it searched one. Dropping it settles that in favour of the
 * honest answer -- the box searches whatever the chip says.
 *
 * The cost is real and worth naming. Everything was the only place a visitor
 * who does not know our nouns could type "art" and discover that groups exist
 * at all. The replacement is the menu itself: it is on the homepage now rather
 * than three clicks into the directory, it names all four kinds with a
 * sentence each, and it says where each one goes -- so the teaching happens on
 * the way in, before the query, instead of in a results page after it.
 *
 * Ordered directory-first because that is the default and a menu should open
 * on its default, then events, groups, panas: public before members-only, so
 * the locked row is last rather than sitting in the middle of the list.
 */
export const SCOPES = ['directory', 'event', 'group', 'pana'] as const;
export type Scope = (typeof SCOPES)[number];

/**
 * Compile-time proof that SCOPES and the typeahead's kinds are the same set.
 *
 * SCOPES is hand-ordered rather than derived from SUGGESTION_KINDS, because
 * menu order is a design decision and suggestion order is a ranking one. That
 * freedom costs a guard: without this, adding a kind upstream would silently
 * leave it out of the menu while every Record below still compiled, and the
 * new kind would be unreachable from the only control that opens it.
 *
 * Checked both ways. A kind missing here is a scope nobody can pick; a scope
 * here that is not a kind is a menu row the typeahead can never fill.
 */
type _ScopeCoverage = [
  Exclude<SuggestionKind, Scope>,
  Exclude<Scope, SuggestionKind>,
] extends [never, never]
  ? true
  : never;
const _scopesMatchKinds: _ScopeCoverage = true;
void _scopesMatchKinds;

/**
 * Where submitting in each scope goes, as a path a reader can see.
 *
 * Shown in the menu under each row. The one piece of information the old menu
 * did not carry and this one must: when four scopes were four views of one
 * page, where you landed needed no explanation. Now one has a map, one has a
 * calendar and one has a join button, so the control says which product it is
 * opening before Enter rather than after.
 *
 * These are routes that already ship, not new ones. /e is the calendar and
 * /groups is the shelf-and-browse page; both are already linked from
 * navigation, so inventing /explore/events beside them would have left two
 * pages answering one question. /panas is the one addition, because panas had
 * no home of their own -- they lived at /directory/panas, which stops being
 * true once the directory means listings.
 */
export const SCOPE_DESTINATION: Record<Scope, string> = {
  directory: '/directory/search',
  event: '/e',
  group: '/groups',
  pana: '/panas',
};

/**
 * Where a search for `term` in `scope` actually lives.
 *
 * The directory delegates to `searchPath` so its canonical URL is built in one
 * place; it carries the term as a path segment, as it always has.
 *
 * The other three carry it as `?q=`, and that is forced rather than chosen.
 * `/e/[slug]` and `/groups/new` already occupy the segment after those roots,
 * so `/e/<term>` would collide with an event slug the moment someone searched
 * for a word that is also a slug. `/groups?q=` already ships and works, so the
 * three explore pages match it rather than each inventing a shape.
 */
export function scopePath(scope: Scope, term: string): string {
  if (scope === 'directory') return searchPath(term);

  const base = SCOPE_DESTINATION[scope];
  const trimmed = term.trim();
  return trimmed ? `${base}?q=${encodeURIComponent(trimmed)}` : base;
}

export const SCOPE_LABEL: Record<Scope, string> = {
  directory: 'Directory',
  event: 'Events',
  group: 'Groups',
  pana: 'Panas',
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
  directory: 'Shops, makers, bands, co-ops and non-profits',
  event: 'Shows, markets and meetups near you',
  group: 'Find your people, or start a group',
  pana: 'Members by name, craft or handle',
};

/**
 * i18n keys for what the search field says once a scope has been picked.
 *
 * A consequence of the move that is easy to miss and expensive to skip. The
 * homepage placeholder was "Search panas, businesses, groups, events" -- it
 * listed the four kinds precisely because the field had no other way to say it
 * covered them. Once the scope is a visible control inside the same pill that
 * list is redundant at best and contradictory at worst: a field reading
 * "Directory" on the left should not invite you to type an event name on the
 * right.
 *
 * So the placeholder narrows with the scope, and in doing so gets to say
 * something useful about *how* to search each kind -- by craft for a listing,
 * by night out for an event, by handle for a pana -- which the four-noun list
 * never had room for.
 *
 * Keys rather than strings, unlike the label and blurb above. Those feed a
 * menu that has never been translated; this feeds the placeholder of the
 * biggest input on the homepage, which has been translated since the page
 * shipped, and hardcoding English here would be a visible regression for every
 * Spanish-speaking visitor. Lives in the `common` namespace beside
 * `search.kind.*`, which the same field already reads.
 *
 * The short forms exist because the full phrase is ~270px of text in a field
 * that has ~138px on a common phone. Same reason the hero already carried a
 * short placeholder before scopes arrived.
 */
export const scopePlaceholderKey = (scope: Scope) =>
  `search.scopePlaceholder.${scope}`;

export const scopePlaceholderShortKey = (scope: Scope) =>
  `search.scopePlaceholderShort.${scope}`;

/**
 * Scopes only offered to signed-in visitors.
 *
 * Panas stay members-only: `lib/server/suggest.ts` treats an anonymous caller
 * as a caller bug for that kind, and a menu offering it to a signed-out
 * visitor would advertise a page that answers nothing.
 *
 * Groups are public as of this change, and that is a deliberate reversal. A
 * group that cannot be found by someone who is not yet a member cannot recruit
 * one, which made the members-only rule self-defeating for the exact case
 * groups exist to serve. The privacy that mattered is kept, but moved to where
 * it belongs -- onto the roster rather than onto the group. Faces and a member
 * count are public; names and profile links are not.
 */
export const SCOPE_REQUIRES_PANA: Record<Scope, boolean> = {
  directory: false,
  event: false,
  group: false,
  pana: true,
};

/**
 * A colour token per scope, from the `[data-tone]` set in app/globals.css that
 * the panaverse switcher already uses.
 *
 * The dropdown, the row icon and the active chip all read from this one map,
 * so a kind cannot be burnt orange in the menu and blue in the results.
 *
 * Four hues far enough apart to be read as four. The previous mapping was
 * burnt / red / flame / blue, which put three of the four inside a 17-degree
 * hue band: directory and events landed 23 units apart in RGB, under the
 * threshold at which most people see two colours rather than one. Those two
 * are the same hue at different brightness, so colour blindness is not the
 * mechanism and normal vision does not rescue it — the system was signalling
 * orange, orange, orange, blue for four different products. Orange leads
 * because app/globals.css says orange carries the brand and the directory is
 * the largest surface.
 *
 * Typed `SurfaceTone` rather than `string` on purpose. These values go
 * straight into a `data-tone` attribute, and a name CSS has no block for
 * resolves to nothing — the accent silently vanishes rather than rendering
 * visibly wrong, so a typo like 'idigo' would ship looking merely plain. The
 * import is type-only and erased at compile time; the two modules do not
 * otherwise reference each other.
 *
 * Three overlaps with SURFACE_TONE in lib/panaverse/branding.ts, which uses
 * these same tokens to answer "which room am I in". Recorded here so the next
 * person does not have to rediscover them:
 *
 * - Moving `group` off flame is a fix, not a regression. `/groups` belongs to
 *   the social surface, whose chrome is flame, so the old `group: 'flame'`
 *   painted a flame accent inside flame chrome — where it could not do its
 *   job at all. Indigo is legible there.
 * - `group: 'indigo'` echoes the www chrome in the home scope menu, since `/`
 *   is the www surface and the menu lists all four scopes on it. This is the
 *   known cost of the mapping rather than a free win: the menu sits on a light
 *   panel so indigo stays legible, it just shares a hue with the masthead
 *   behind it.
 * - `pana: 'blue'` matches the admin surface. Pre-existing, and admin is
 *   staff-only, so a member never sees both at once. Left alone.
 *
 * The Events room in SHARED_ROOMS moved to pink alongside `event` here, so the
 * noun reads one colour whether you reach it through the scope bar or the
 * switcher. See the comment on that entry for why flame could not stay.
 */
export const SCOPE_TONE: Record<Scope, SurfaceTone> = {
  directory: 'orange',
  event: 'pink',
  group: 'indigo',
  pana: 'blue',
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

/**
 * The scope a bare search lands in when nobody has chosen one.
 *
 * The directory: the largest set, the only one that is entirely public, and
 * what the club is most often asked for by someone arriving cold. It is also
 * what a bare search already did, so no one's muscle memory breaks on the day
 * this ships.
 */
export const DEFAULT_SCOPE: Scope = 'directory';

export type ScopeCounts = Record<Scope, number>;

/** All zeroes — what a caller shows when counts are unknown or failed. */
export const EMPTY_SCOPE_COUNTS: ScopeCounts = {
  directory: 0,
  pana: 0,
  group: 0,
  event: 0,
};

/** Total across the four kinds. */
export function totalCount(counts: ScopeCounts): number {
  return counts.directory + counts.pana + counts.group + counts.event;
}

export function countFor(counts: ScopeCounts, scope: Scope): number {
  return counts[scope];
}

/**
 * Resolve an old /directory/<segment> URL to the scope it used to mean.
 *
 * Only the retired scope routes call this, to work out where an inbound link
 * should be sent. Returns null rather than falling back to a default so those
 * routes can answer 404 for a typo instead of serving a working redirect at an
 * unbounded number of URLs.
 */
const SEGMENT_SCOPE: Record<string, Scope> = {
  panas: 'pana',
  groups: 'group',
  events: 'event',
};

export function scopeFromSegment(segment: string): Scope | null {
  return SEGMENT_SCOPE[segment] ?? null;
}
