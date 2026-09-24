'use client';

import { LayoutList, Map as MapIcon, X } from 'lucide-react';
import { countyList, profileCategoryList } from '@/lib/lists';
import type { DirectorySort } from '@/lib/query/directory';

export type ResultView = 'list' | 'map';

/** The subset of search state this bar owns. */
export interface FilterState {
  categories: string[];
  counties: string[];
  certifiedOnly: boolean;
  withEventsOnly: boolean;
  sort: DirectorySort;
}

const COUNTY_LABEL: Record<string, string> = {
  palm_beach: 'Palm Beach',
  broward: 'Broward',
  miami_dade: 'Miami-Dade',
};

const SORT_OPTIONS: { key: DirectorySort; label: string }[] = [
  { key: 'relevance', label: 'Best match' },
  { key: 'nearest', label: 'Nearest' },
  { key: 'recommended', label: 'Most recommended' },
  { key: 'name', label: 'A–Z' },
];

/**
 * Anchor for the county chips.
 *
 * Exported because the search band links here when a member has declined the
 * location prompt: counties are the answer to "what is near me" that needs no
 * permission, and the two components are siblings with no other way to point
 * at each other.
 */
export const COUNTY_FILTER_ID = 'directory-county-filter';

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  view: ResultView;
  onViewChange: (next: ResultView) => void;
  /** Disables "Nearest" until there is a location to measure from. */
  locationShared: boolean;
}

/**
 * Refinement, in the open.
 *
 * The directory this replaces hid every filter behind a "Filters" button. That
 * costs two clicks before you learn the directory even has categories, hides
 * which ones are active once the dialog closes, and gives a phone user a
 * full-screen modal to dismiss between every adjustment.
 *
 * Here the choices are chips on the page: you can see what is available, see
 * what is on, and turn one off by clicking it.
 */
export function FilterBar({
  filters,
  onChange,
  view,
  onViewChange,
  locationShared,
}: FilterBarProps) {
  const toggleIn = (list: string[], value: string) =>
    list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];

  const activeCount =
    filters.categories.length +
    filters.counties.length +
    (filters.certifiedOnly ? 1 : 0) +
    (filters.withEventsOnly ? 1 : 0);

  return (
    <div className="dirsearch-filters">
      <div className="dirsearch-filterinner">
        <div className="dirsearch-filterrow">
          <span className="dirsearch-filterlabel">Category</span>
          <ul className="dirsearch-chiprow">
            {profileCategoryList.map((category) => {
              const on = filters.categories.includes(category.value);
              return (
                <li key={category.value}>
                  <button
                    type="button"
                    className="dirsearch-chip"
                    data-on={on}
                    aria-pressed={on}
                    onClick={() =>
                      onChange({
                        ...filters,
                        categories: toggleIn(
                          filters.categories,
                          category.value
                        ),
                      })
                    }
                  >
                    {category.desc}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div
          className="dirsearch-filterrow scroll-mt-24"
          id={COUNTY_FILTER_ID}
          tabIndex={-1}
        >
          <span className="dirsearch-filterlabel">Where</span>
          <ul className="dirsearch-chiprow">
            {[...countyList].reverse().map((county) => {
              const on = filters.counties.includes(county.value);
              return (
                <li key={county.value}>
                  <button
                    type="button"
                    className="dirsearch-chip"
                    data-on={on}
                    aria-pressed={on}
                    onClick={() =>
                      onChange({
                        ...filters,
                        counties: toggleIn(filters.counties, county.value),
                      })
                    }
                  >
                    {COUNTY_LABEL[county.value] ?? county.desc}
                  </button>
                </li>
              );
            })}

            <li aria-hidden="true" className="dirsearch-chipdivide" />

            <li>
              <button
                type="button"
                className="dirsearch-chip"
                data-on={filters.certifiedOnly}
                aria-pressed={filters.certifiedOnly}
                title="Vetted by Pana Mia staff"
                onClick={() =>
                  onChange({
                    ...filters,
                    certifiedOnly: !filters.certifiedOnly,
                  })
                }
              >
                Pana Certified
              </button>
            </li>
            <li>
              <button
                type="button"
                className="dirsearch-chip"
                data-on={filters.withEventsOnly}
                aria-pressed={filters.withEventsOnly}
                title="Has something on in the next three months"
                onClick={() =>
                  onChange({
                    ...filters,
                    withEventsOnly: !filters.withEventsOnly,
                  })
                }
              >
                Has events coming up
              </button>
            </li>
          </ul>
        </div>

        <div className="dirsearch-filterfoot">
          <label className="dirsearch-sort">
            <span>Sort</span>
            <select
              value={filters.sort}
              onChange={(event) =>
                onChange({
                  ...filters,
                  sort: event.target.value as DirectorySort,
                })
              }
            >
              {SORT_OPTIONS.map((option) => (
                <option
                  key={option.key}
                  value={option.key}
                  // Nearest is meaningless with nothing to measure from, and
                  // offering it anyway would produce an order the viewer
                  // cannot account for.
                  disabled={option.key === 'nearest' && !locationShared}
                >
                  {option.label}
                  {option.key === 'nearest' && !locationShared
                    ? ' — share location first'
                    : ''}
                </option>
              ))}
            </select>
          </label>

          {activeCount > 0 && (
            <button
              type="button"
              className="dirsearch-clear"
              onClick={() =>
                onChange({
                  ...filters,
                  categories: [],
                  counties: [],
                  certifiedOnly: false,
                  withEventsOnly: false,
                })
              }
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
            </button>
          )}

          {/* A map is how you answer "what is near me" when you do not yet
              know what you are looking for, which is most of the time. On a
              wide screen it is not a choice at all: the list and the map are
              side by side and this toggle is hidden. It exists for the widths
              where only one of them fits. */}
          <div className="dirsearch-viewtoggle">
            <button
              type="button"
              data-on={view === 'list'}
              aria-pressed={view === 'list'}
              onClick={() => onViewChange('list')}
            >
              <LayoutList className="h-4 w-4" aria-hidden="true" />
              List
            </button>
            <button
              type="button"
              data-on={view === 'map'}
              aria-pressed={view === 'map'}
              onClick={() => onViewChange('map')}
            >
              <MapIcon className="h-4 w-4" aria-hidden="true" />
              Map
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
