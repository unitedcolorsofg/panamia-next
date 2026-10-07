import { notFound, permanentRedirect } from 'next/navigation';
import { scopeFromSegment, scopePath } from '@/lib/directory-scopes';

/**
 * Retired. /directory/events?q=salsa now lands on /e?q=salsa.
 *
 * These segments — events, groups, panas and the old `all` — were the
 * directory's other scopes back when it was the club's single index and the
 * scope control was a row of chips above the results. Each kind now has a page
 * built for it, so this route has nothing left to render and exists only to
 * forward the links that already point at it.
 *
 * Permanent, unlike the term-carrying redirects in /search: the move is
 * structural rather than a product guess. /directory/panas is not coming back
 * under that name, because the word "directory" stopped covering people the
 * moment it started covering bands and co-ops.
 *
 * 404 for anything else. A working redirect at an unbounded set of URLs is
 * worse than an honest miss at one, and `scopeFromSegment` returning null is
 * how a typo is told apart from a retired route.
 *
 * @see lib/directory-scopes.ts - SCOPE_DESTINATION, the map these resolve through
 */
interface PageProps {
  params: Promise<{ scope: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function RetiredDirectoryScopePage({
  params,
  searchParams,
}: PageProps) {
  const { scope: segment } = await params;
  const { q } = await searchParams;
  const term = (q ?? '').trim();

  // `all` was the Everything scope: one page previewing four kinds. There is
  // no Everything any more, and the directory is both the default scope and
  // the largest of the four, so that is the honest landing place for a link
  // that asked for breadth.
  if (segment === 'all') permanentRedirect(scopePath('directory', term));

  const scope = scopeFromSegment(segment);
  if (!scope) notFound();

  permanentRedirect(scopePath(scope, term));
}
