import { Metadata } from 'next';
import { PanaSearchPage } from './_components/pana-search-page';

/**
 * /panas — member search.
 *
 * Moved here from /directory/panas, where it lived while "directory" meant
 * the club's whole index. The directory now means listings, so people needed
 * a door of their own; /directory/panas redirects here and will keep doing so.
 *
 * The term rides in `?q=` rather than a path segment, matching /e and /groups.
 * Those two had no choice — `/e/[slug]` and `/groups/new` already own the
 * segment after their roots — and three explore pages sharing one URL grammar
 * is worth more than this one page having a prettier URL than its siblings.
 * The directory keeps path segments because its URLs are public and indexed;
 * these are not.
 */
interface PageProps {
  searchParams: Promise<{ q?: string; p?: string }>;
}

export const metadata: Metadata = {
  title: 'Panas | Pana MIA Club',
  description: 'Search members by name, craft or handle.',
  alternates: { canonical: '/panas' },
  // Members searching members. The page is real and reachable, but
  // enumerating the membership for crawlers is the exact thing lib/accounts
  // keeps personal accounts out of the public directory for.
  robots: { index: false, follow: false },
};

export default async function PanasPage({ searchParams }: PageProps) {
  const { q, p } = await searchParams;

  return <PanaSearchPage term={(q ?? '').trim()} page={pageNumber(p)} />;
}

function pageNumber(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
