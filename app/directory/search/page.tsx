import { Suspense } from 'react';
import { Metadata } from 'next';
import { DirectorySearchContent } from './_components/search-content';
import { SearchFallback } from './_components/search-fallback';

/**
 * Directory search, query form: /directory/search and /directory/search/?q=dj
 *
 * The path form in ./[q] is canonical — the form and every filter/page control
 * navigate there. This route stays for the bare browse view and for the ?q=
 * links already in the wild, and points search engines at the path form so the
 * two spellings of one search do not split.
 */
interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const raw = params.q;
  const term = (Array.isArray(raw) ? raw[0] : (raw ?? '')).trim();

  return {
    title: term ? `${term} | Pana Mia Directory` : 'Directory | Pana Mia',
    description: 'Explore South Florida locals and communities on Pana Mia.',
    alternates: {
      canonical: term
        ? `/directory/search/${encodeURIComponent(term)}`
        : '/directory/search',
    },
  };
}

export default function DirectorySearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <DirectorySearchContent />
    </Suspense>
  );
}
