import { redirect, permanentRedirect } from 'next/navigation';
import { scopePath, DEFAULT_SCOPE, type Scope } from '@/lib/directory-scopes';

/**
 * Retired. /search?q=zines&tab=groups now lands on the club's own pages.
 *
 * This was Pana Social's own index over Panas and groups, built while the
 * directory held businesses alone. Keeping both meant two rankings, two
 * visibility contracts and two places a member could search and miss
 * something — and the masthead field had to pick one, which is the bug that
 * started this.
 *
 * A redirect rather than a delete because the old page was linkable: its tabs
 * were real URLs, on purpose, so that a result set could be shared with the
 * tab it was read on. Those links are in people's messages.
 *
 * `tab` is honoured rather than dropped. Someone who bookmarked the Groups tab
 * asked for groups, and `/groups?q=<term>` is that same question in the club's
 * current spelling; a visitor with no tab at all gets the directory, which is
 * the default scope everywhere else.
 *
 * The noindex this page used to carry for private groups is now structural
 * rather than a directive, though the shape of it has changed: groups are
 * public as of this redesign — a group nobody outside it can find cannot
 * recruit anybody — so the gate has moved off the group list and onto the
 * roster, where names and profile links are the parts that stay private.
 * Panas remain behind sign-in, so `tab=panas` still resolves to a gate.
 *
 * @see lib/directory-scopes.ts - the scopes and their destinations
 */

/* Typed structurally rather than as `Metadata`: the vinext `next` shim does
   not export that type, and importing it adds to the repo's existing wall of
   "has no exported member 'Metadata'" errors for no benefit here. */
export const metadata = {
  title: 'Search | Pana MIA',
  robots: { index: false, follow: true },
};

/** The old tab ids, in the directory's spelling. */
const TAB_SCOPE: Record<string, Scope> = {
  panas: 'pana',
  groups: 'group',
};

export default async function RetiredSocialSearchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};

  const rawTerm = params.q;
  const term = (Array.isArray(rawTerm) ? rawTerm[0] : (rawTerm ?? '')).trim();

  const rawTab = params.tab;
  const tab = Array.isArray(rawTab) ? rawTab[0] : rawTab;
  const scope = (tab && TAB_SCOPE[tab]) || DEFAULT_SCOPE;

  // No term is no search, so there is nothing to carry across and the bare
  // scope route is the honest destination. Permanent because that mapping
  // cannot change: a search with no query is a browse under any scheme.
  if (!term) permanentRedirect(scopePath(scope, ''));

  // Temporary for a term, because which scope a `tab` becomes is a product
  // decision that could be revisited, and a 308 is cached by the browser in a
  // way that would outlive the decision.
  redirect(scopePath(scope, term));
}
