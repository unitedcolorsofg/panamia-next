import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ScopePage } from '../../_components/scope-page';
import { SCOPE_BLURB, SCOPE_LABEL, scopeFromSegment } from '@/lib/directory-scopes';

/**
 * Path-form scoped search: /directory/events/salsa, /directory/panas/maria.
 *
 * Mirrors /directory/search/[q] exactly — term in the path, everything else in
 * query params — so the four scopes have one URL grammar between them rather
 * than one each.
 *
 * `search` is a static sibling segment, so /directory/search never reaches
 * this route: Next resolves static segments before dynamic ones. That is what
 * lets businesses keep their own page while the other scopes share this one.
 */
interface PageProps {
  params: Promise<{ scope: string; q: string }>;
  searchParams: Promise<{ p?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { scope: segment, q } = await params;
  const scope = scopeFromSegment(segment);
  if (!scope) return {};

  const term = safeDecode(q).trim();
  const label = SCOPE_LABEL[scope];

  return {
    title: term
      ? `${term} — ${label} | Pana Mia Directory`
      : `${label} | Pana Mia Directory`,
    description: `${SCOPE_BLURB[scope]} — search "${term}" on Pana Mia.`,
    alternates: {
      canonical: `/directory/${segment}/${encodeURIComponent(term)}`,
    },
    // Panas are members searching members. The page is real and reachable,
    // but enumerating the membership for crawlers is the exact thing
    // lib/accounts keeps personal accounts out of the public directory for.
    robots: scope === 'pana' ? { index: false, follow: false } : undefined,
  };
}

export default async function DirectoryScopeTermPage({
  params,
  searchParams,
}: PageProps) {
  const { scope: segment, q } = await params;
  const scope = scopeFromSegment(segment);
  // A typo or a probe. Serving a working page for an unbounded set of URLs
  // would be worse than answering 404 for one.
  if (!scope) notFound();

  const { p } = await searchParams;

  return (
    <ScopePage scope={scope} term={safeDecode(q)} page={pageNumber(p)} />
  );
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

function pageNumber(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
