'use client';

import Link from 'next/link';
import { ArrowRight, SearchX } from 'lucide-react';
import { profileCategoryList } from '@/lib/lists';
import type { QueryState } from '../_data';

interface EmptyStateProps {
  query: QueryState;
  activeFilterCount: number;
  onChange: (next: QueryState) => void;
}

/**
 * What the page says when nothing matched.
 *
 * The current directory prints one grey sentence — "No results found. Try a
 * different search term or adjust your filters" — which restates the problem
 * and leaves the visitor to solve it. A dead end here is expensive: the
 * directory is small enough that a near-miss search is normal, and this is
 * exactly the moment someone decides the site is empty and leaves.
 *
 * So this does the adjusting for them. If filters are on, the first offer is
 * to drop them, because that is the likeliest cause and the visitor may not
 * remember setting them. Then it offers categories as one-click escapes, and
 * only after that suggests telling us what is missing.
 */
export function EmptyState({
  query,
  activeFilterCount,
  onChange,
}: EmptyStateProps) {
  return (
    <div className="dirsearch-empty">
      <SearchX className="h-9 w-9" aria-hidden="true" />

      <h2 className="dirsearch-empty-title">
        {query.term ? (
          <>
            Nothing matched <em>{query.term}</em>
          </>
        ) : (
          <>Nothing matched those filters</>
        )}
      </h2>

      <p className="dirsearch-empty-lede">
        {activeFilterCount > 0
          ? `You have ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} on. Widening usually finds it.`
          : 'The directory is still growing — try a broader word, or browse a category.'}
      </p>

      <div className="dirsearch-empty-actions">
        {activeFilterCount > 0 && (
          <button
            type="button"
            className="dirsearch-empty-primary"
            onClick={() =>
              onChange({
                ...query,
                categories: [],
                counties: [],
                certifiedOnly: false,
                openToEvents: false,
              })
            }
          >
            Clear filters and search again
          </button>
        )}
        {query.term && (
          <button
            type="button"
            className="dirsearch-empty-secondary"
            onClick={() => onChange({ ...query, term: '' })}
          >
            Browse everything instead
          </button>
        )}
      </div>

      <p className="dirsearch-empty-or">Or start from a category</p>

      <ul className="dirsearch-empty-cats">
        {profileCategoryList.slice(0, 8).map((category) => (
          <li key={category.value}>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...query,
                  term: '',
                  categories: [category.value],
                  counties: [],
                  certifiedOnly: false,
                  openToEvents: false,
                })
              }
            >
              {category.desc}
            </button>
          </li>
        ))}
      </ul>

      <Link href="/form/contact-us" className="link-arrow mt-9 inline-flex">
        Know a local spot we are missing? Tell us
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
