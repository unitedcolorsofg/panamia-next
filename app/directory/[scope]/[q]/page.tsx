import { notFound, permanentRedirect } from 'next/navigation';
import { scopeFromSegment, scopePath } from '@/lib/directory-scopes';

/**
 * Retired. /directory/panas/maria now lands on /panas?q=maria.
 *
 * The path-form half of the retired scope routes. These URLs were the
 * canonical, shareable spelling of a scoped search — the form the old
 * query-string route redirected *to* — so they are the ones most likely to be
 * sitting in somebody's messages, and the ones it matters most to forward.
 *
 * `search` is a static sibling segment, so /directory/search/<term> never
 * reaches this route: Next resolves static segments before dynamic ones. That
 * is what lets the directory keep its own page while these forward away.
 *
 * @see app/directory/[scope]/page.tsx - the query-form half, and the reasoning
 */
interface PageProps {
  params: Promise<{ scope: string; q: string }>;
}

export default async function RetiredDirectoryScopeTermPage({
  params,
}: PageProps) {
  const { scope: segment, q } = await params;
  const term = safeDecode(q);

  if (segment === 'all') permanentRedirect(scopePath('directory', term));

  const scope = scopeFromSegment(segment);
  // A typo or a probe. Serving a working redirect for an unbounded set of
  // URLs would be worse than answering 404 for one.
  if (!scope) notFound();

  permanentRedirect(scopePath(scope, term));
}

/** decodeURIComponent throws on a malformed escape ("%"), which would 500 the
 *  page for what is really just a bad URL. Fall back to the raw segment. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
