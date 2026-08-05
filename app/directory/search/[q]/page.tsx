import { Suspense } from 'react';
import { Metadata } from 'next';
import { DirectorySearchContent } from '../_components/search-content';
import { SearchFallback } from '../_components/search-fallback';

/**
 * Path-form directory search: /directory/search/dj
 *
 * Serves exactly what /directory/search/?q=dj serves, and is the canonical of
 * the two — a readable URL is worth having for the term people actually share.
 * The static sibling route still handles /directory/search and the ?q= form,
 * which keeps old links and bookmarks alive; Next resolves the static segment
 * first, so the two never contend.
 *
 * Only the term lives in the path. Filters and pagination stay query params,
 * so a filtered search reads /directory/search/dj?fcat=music&p=2.
 */
interface PageProps {
  params: Promise<{ q: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { q } = await params;
  const term = decodeURIComponent(q).trim();

  return {
    title: term
      ? `${term} | Pana Mia Directory`
      : 'Search | Pana Mia Directory',
    description: `Search South Florida locals and communities for "${term}" on Pana Mia.`,
    alternates: {
      canonical: `/directory/search/${encodeURIComponent(term)}`,
    },
  };
}

export default async function DirectorySearchTermPage({ params }: PageProps) {
  const { q } = await params;
  // Next hands params through already percent-decoded, but a term that was
  // double-encoded upstream would arrive still escaped; decoding defensively
  // costs nothing and a plain term is unchanged by it.
  const term = safeDecode(q);

  return (
    <Suspense fallback={<SearchFallback />}>
      <DirectorySearchContent initialTerm={term} />
    </Suspense>
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
