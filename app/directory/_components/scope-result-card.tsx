import Image from 'next/image';
import Link from 'next/link';
import { KIND_ICON } from '@/components/kind-icon';
import type { ScopeResult } from '@/lib/server/search-kinds';
import type { SuggestionKind } from '@/lib/suggest';

/**
 * One result row, for the scopes that are not the business directory.
 *
 * Deliberately one card rather than four. The mock argued the opposite case
 * and argued it well — a pana has no address, a group has no location column
 * at all — but that argument was about *layout*, and these three scopes ended
 * up sharing one. What differs between them is which fields are populated, and
 * a card that renders `subtitle` and `meta` when present handles that without
 * four near-identical components drifting apart.
 *
 * No kind badge on the card. Every list that shows one is either a
 * single-kind scope or a kind-headed section in Everything, so a badge per row
 * repeats what the thing above it already said. The icon still appears as the
 * image placeholder, where it is doing work rather than labelling.
 *
 * The business scope keeps its own card over in search/_components: it carries
 * certification, category pills, recommendation counts and distance, none of
 * which the other three have anything to put in.
 */
export function ScopeResultCard({
  result,
  kind,
}: {
  result: ScopeResult;
  kind: SuggestionKind;
}) {
  const Icon = KIND_ICON[kind];
  // Faces and storefronts are circles everywhere else in the product; a group
  // or event cover cropped to a circle loses most of itself.
  const round = kind === 'business' || kind === 'pana';

  return (
    <Link href={result.href} className="dirsearch-card group block">
      <div className="flex items-start gap-3">
        <span
          className={`relative flex h-12 w-12 flex-none items-center justify-center overflow-hidden bg-black/5 ${
            round ? 'rounded-full' : 'rounded-lg'
          }`}
        >
          {result.imageUrl ? (
            <Image
              src={result.imageUrl}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <Icon className="h-5 w-5 opacity-40" aria-hidden="true" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-black tracking-tight group-hover:underline">
              {result.name}
            </span>
          </span>

          {result.subtitle && (
            <span className="text-pana-ink/70 mt-0.5 line-clamp-2 block text-sm">
              {result.subtitle}
            </span>
          )}

          {result.meta && (
            <span className="text-pana-ink/55 mt-1 block text-xs font-bold tracking-wide uppercase">
              {result.meta}
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}
