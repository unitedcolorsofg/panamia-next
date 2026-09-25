import type { Metadata } from 'next';
import { UnifiedDirectory } from './_components/unified-directory';

/**
 * /mock/directory-unified — one directory theme for all four kinds.
 *
 * Why this exists: the live directory renders two different pages depending on
 * which chip you click. `/directory/search` (businesses) opens with a compact
 * toolbar and rich cards. `/directory/[scope]/[q]` (everything else) opens
 * with a tall indigo hero and 48px thumbnail rows. Neither is wrong on its
 * own — they were built PRs apart, and the scope pages reused the hero band
 * that the business page had already replaced in #206 for being 570px of
 * chrome on a page you refine five times in a row. Side by side they read as
 * two products, and the scope chips promise they are one.
 *
 * This merges them in the only direction that does not lose information: the
 * newer chrome, the richer card, and per-kind content rules rather than
 * per-template ones. See `_data.ts` for the slot-by-slot argument.
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
