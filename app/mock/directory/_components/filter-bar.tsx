'use client';

import { LayoutList, Map as MapIcon, X } from 'lucide-react';
import { countyList, profileCategoryList } from '@/lib/lists';
import {
  COUNTY_LABEL,
  SORT_OPTIONS,
  type QueryState,
  type SortKey,
} from '../_data';

export type ResultView = 'list' | 'map';

interface FilterBarProps {
  query: QueryState;
  onChange: (next: QueryState) => void;
  view: ResultView;
  onViewChange: (next: ResultView) => void;
  /** Disables "Nearest" until there is a location to measure from. */
  locationShared: boolean;
}

/**
 * Refinement, in the open.
 *
 * The current directory hides every filter behind a dialog with a "Filters"
 * button. That costs two clicks before you learn the directory even has
 * categories, hides which ones are active once it closes, and gives a phone
 * user a full-screen modal to dismiss between every adjustment.
 *
 * Here the choices are chips on the page. You can see what is available, see
 * what is on, and turn one off by clicking it — refining a search should not
 * be a form you submit.
 */
export function FilterBar({
  query,
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
    query.categories.length +
    query.counties.length +
    (query.certifiedOnly ? 1 : 0) +
    (query.openToEvents ? 1 : 0);

  return (
    <div className="dirsearch-filters">
      <div className="container mx-auto px-4">
        <div className="dirsearch-filterrow">
          <span className="dirsearch-filterlabel">Category</span>
          <ul className="dirsearch-chiprow">
            {profileCategoryList.map((category) => {
              const on = query.categories.includes(category.value);
              return (
                <li key={category.value}>
                  <button
                    type="button"
                    className="dirsearch-chip"
                    data-on={on}
                    aria-pressed={on}
                    onClick={() =>
                      onChange({
                        ...query,
                        categories: toggleIn(query.categories, category.value),
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

        <div className="dirsearch-filterrow">
          <span className="dirsearch-filterlabel">Where</span>
          <ul className="dirsearch-chiprow">
            {[...countyList].reverse().map((county) => {
              const on = query.counties.includes(county.value);
              return (
                <li key={county.value}>
                  <button
                    type="button"
                    className="dirsearch-chip"
                    data-on={on}
                    aria-pressed={on}
                    onClick={() =>
                      onChange({
                        ...query,
                        counties: toggleIn(query.counties, county.value),
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
                data-on={query.certifiedOnly}
                aria-pressed={query.certifiedOnly}
                title="Vetted by Pana Mia staff"
                onClick={() =>
                  onChange({ ...query, certifiedOnly: !query.certifiedOnly })
                }
              >
                Pana Certified
              </button>
            </li>
            <li>
              <button
                type="button"
                className="dirsearch-chip"
                data-on={query.openToEvents}
                aria-pressed={query.openToEvents}
                title="Has something on in the next three months"
                onClick={() =>
                  onChange({ ...query, openToEvents: !query.openToEvents })
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
              value={query.sort}
              onChange={(event) =>
                onChange({ ...query, sort: event.target.value as SortKey })
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
                  ...query,
                  categories: [],
                  counties: [],
                  certifiedOnly: false,
                  openToEvents: false,
                })
              }
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
            </button>
          )}

          {/* A map is how you answer "what is near me" when you do not yet
              know what you are looking for, which is most of the time. It is
              a peer of the list, not a setting, so it sits here. */}
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
