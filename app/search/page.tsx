import { redirect, permanentRedirect } from 'next/navigation';
import { scopePath, type Scope } from '@/lib/directory-scopes';

/**
 * Retired. /search?q=zines&tab=groups now lands in the directory.
 *
 * This was Pana Social's own index over Panas and groups, built while the
 * directory held businesses alone. The directory now covers all four kinds,
 * so keeping both meant two rankings, two visibility contracts and two places
 * a member could search and miss something — and the masthead field had to
 * pick one, which is the bug that started this. The directory won because it
 * is the only one of the two that can answer "events" at all.
 *
 * A redirect rather than a delete because the old page was linkable: its tabs
 * were real URLs, on purpose, so that a result set could be shared with the
 * tab it was read on. Those links are in people's messages.
 *
 * `tab` is honoured rather than dropped. Someone who bookmarked the Groups tab
 * asked for groups, and /directory/group/<term> is that same question in the
 * directory's spelling; only a visitor with no tab at all gets Everything.
 *
 * The noindex this page used to carry for private groups is now structural
 * rather than a directive: the directory gates the Panas and Groups scopes
 * behind sign-in, so an anonymous crawler is answered with the gate and never
 * reaches a group name at all.
 *
 * @see lib/directory-scopes.ts - the scopes and their paths
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
  const scope = (tab && TAB_SCOPE[tab]) || 'all';

  // No term is no search, so there is nothing to carry across and the bare
  // scope route is the honest destination. Permanent because that mapping
  // cannot change: a search with no query is a browse under any scheme.
  if (!term) permanentRedirect(scopePath(scope, ''));

  // Temporary for a term, because which scope a `tab` becomes is a product
  // decision that could be revisited, and a 308 is cached by the browser in a
  // way that would outlive the decision.
  redirect(scopePath(scope, term));
}
