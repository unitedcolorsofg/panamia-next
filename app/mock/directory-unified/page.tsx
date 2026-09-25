import type { Metadata } from 'next';
import { UnifiedDirectory } from './_components/unified-directory';

/**
 * /mock/directory-unified — one directory theme for all four kinds.
 *
 * Why this exists: the live directory renders two different pages depending on
 * which chip you click. `/directory/search` (businesses) opens with a compact
 * toolbar and rich cards. `/directory/[scope]/[q]` (everything else) opens
 * with the indigo band and 48px thumbnail rows. Measured against the same
 * record — Taller Lucía, searching "art" — the businesses page gives it a
 * 458px card carrying ten facts and the everything page gives it a 70px row
 * carrying three. Same business, same query, two products.
 *
 * The merge keeps the band and its search bar exactly as they ship. The scope
 * control belongs inside the pill, and a directory landing on a real query
 * earns a headline; that argument was settled and is not reopened here. What
 * changes is below the band: the rich card replaces the thumbnail row for all
 * four kinds, and the facet rail the scope pages never had appears, scoped to
 * the rows each kind can actually answer.
 *
 * So the direction is the opposite of what the file layout suggests: the
 * businesses page should adopt this band, not the other way round. See
 * `_data.ts` for the slot-by-slot argument about the card.
 *
 * This page is a server component purely so it can carry `robots: noindex`,
 * which app/mock/README.md requires of every mock route and which no mock
 * currently sets. robots.ts does not disallow /mock either, so the header is
 * the only thing actually keeping these out of search results.
 */
export const metadata: Metadata = {
  title: 'Mock — unified directory',
  robots: { index: false, follow: false },
};

export default function UnifiedDirectoryMockPage() {
  return <UnifiedDirectory />;
}
