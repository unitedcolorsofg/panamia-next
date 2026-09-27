'use client';

import { LayoutList, Map as MapIcon, X } from 'lucide-react';
import { countyList, profileCategoryList } from '@/lib/lists';
import type { DirectorySort } from '@/lib/query/directory';
import { FilterMenu, type FilterMenuOption } from './filter-menu';

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
 * Anchor for the county filter.
 *
 * Exported because the search band links here when a member has declined the
 * location prompt: counties are the answer to "what is near me" that needs no
 * permission, and the two components are siblings with no other way to point
 * at each other.
 */
export const COUNTY_FILTER_ID = 'directory-county-filter';

/** The two standalone toggles, as menu options so they can share the Where menu. */
const CERTIFIED = 'certified';
const WITH_EVENTS = 'with-events';

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  view: ResultView;
  onViewChange: (next: ResultView) => void;
  /** Disables "Nearest" until there is a location to measure from. */
  locationShared: boolean;
}

/**
 * Refinement, on one line.
 *
 * This bar used to lay every choice out as chips across three labelled rows —
 * Category, Where, then a footer for sort and the list/map toggle. The
 * argument for that was a good one and is worth restating: the directory it
 * replaced hid everything behind a "Filters" button, which costs two clicks
 * before you learn the directory has categories at all, hides what is active
 * once the dialog closes, and gives a phone a full-screen modal to dismiss
 * between every adjustment.
 *
 * What that argument missed is the cost on a phone. Measured at 390x844: the
 * band ended at 336, the three rows and the footer ran to 603, and the first
 * business card started at 627 — 74% of the screen was controls, and the one
 * result you could see was the thing you came for. Filters being visible is
 * worth very little if the businesses are not.
 *
 * So the rows fold into menus and the two useful properties are kept by other
 * means. Each trigger names its own state, so a closed Category menu still
 * reads "Category · 2" rather than going quiet. And every active choice is
 * repeated underneath as a removable chip, so seeing what is on and turning
 * one off both stay one glance and one click — which is all the chip rows were
 * ever really buying. Scope is gone from here entirely: it lives in the search
 * pill, one control up, and having it twice on a 390px screen was the least
 * defensible of the four rows.
 */
export function FilterBar({
  filters,
  onChange,
  view,
  onViewChange,
  locationShared,
}: FilterBarProps) {
  const categoryOptions: FilterMenuOption[] = profileCategoryList.map(
    (category) => ({ value: category.value, label: category.desc })
  );

  // Counties and the two qualities share one menu. They are different kinds of
  // question — where it is, versus what it is — but both answer "narrow this
  // down", and two more triggers on a phone costs more than the tidiness of
  // separating them is worth. The hints carry the distinction instead.
  const whereOptions: FilterMenuOption[] = [
    ...[...countyList].reverse().map((county) => ({
      value: county.value,
      label: COUNTY_LABEL[county.value] ?? county.desc,
    })),
    {
      value: CERTIFIED,
      label: 'Pana Certified',
      hint: 'Vetted by Pana Mia staff',
    },
    {
      value: WITH_EVENTS,
      label: 'Has events coming up',
      hint: 'Something on in the next three months',
    },
  ];

  const whereSelected = [
    ...filters.counties,
    ...(filters.certifiedOnly ? [CERTIFIED] : []),
    ...(filters.withEventsOnly ? [WITH_EVENTS] : []),
  ];

  const applyWhere = (next: string[]) =>
    onChange({
      ...filters,
      counties: next.filter(
        (value) => value !== CERTIFIED && value !== WITH_EVENTS
      ),
      certifiedOnly: next.includes(CERTIFIED),
      withEventsOnly: next.includes(WITH_EVENTS),
    });

  const sortOptions: FilterMenuOption[] = SORT_OPTIONS.map((option) => ({
    value: option.key,
    label: option.label,
    // Nearest is meaningless with nothing to measure from, and offering it
    // anyway would produce an order the viewer cannot account for.
    disabledReason:
      option.key === 'nearest' && !locationShared
        ? 'Share your location first'
        : undefined,
  }));

  // Every active filter as one removable chip, in the order the menus present
  // them. This is the row that keeps the old bar's promise: what is on is on
  // the page, and turning it off never requires opening a menu first.
  const activeChips: { key: string; label: string; clear: () => void }[] = [
    ...filters.categories.map((value) => ({
      key: `cat:${value}`,
      label:
        profileCategoryList.find((category) => category.value === value)
          ?.desc ?? value,
      clear: () =>
        onChange({
          ...filters,
          categories: filters.categories.filter((item) => item !== value),
        }),
    })),
    ...filters.counties.map((value) => ({
      key: `county:${value}`,
      label: COUNTY_LABEL[value] ?? value,
      clear: () =>
        onChange({
          ...filters,
          counties: filters.counties.filter((item) => item !== value),
        }),
    })),
    ...(filters.certifiedOnly
      ? [
          {
            key: CERTIFIED,
            label: 'Pana Certified',
            clear: () => onChange({ ...filters, certifiedOnly: false }),
          },
        ]
      : []),
    ...(filters.withEventsOnly
      ? [
          {
            key: WITH_EVENTS,
            label: 'Has events coming up',
            clear: () => onChange({ ...filters, withEventsOnly: false }),
          },
        ]
      : []),
  ];

  return (
    <div className="dirsearch-filters">
      <div className="dirsearch-filterinner dirsearch-filterinner--menus">
        <div className="dirsearch-menurow" id={COUNTY_FILTER_ID} tabIndex={-1}>
          <FilterMenu
            label="Category"
            options={categoryOptions}
            selected={filters.categories}
            onChange={(categories) => onChange({ ...filters, categories })}
          />

          <FilterMenu
            label="Where"
            options={whereOptions}
            selected={whereSelected}
            onChange={applyWhere}
          />

          <FilterMenu
            label="Sort"
            options={sortOptions}
            selected={[filters.sort]}
            single
            defaultValue="relevance"
            onChange={([sort]) =>
              onChange({ ...filters, sort: sort as DirectorySort })
            }
          />

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

        {activeChips.length > 0 && (
          <div className="dirsearch-activerow">
            <ul className="dirsearch-chiprow">
              {activeChips.map((chip) => (
                <li key={chip.key}>
                  <button
                    type="button"
                    className="dirsearch-activechip"
                    onClick={chip.clear}
                  >
                    {chip.label}
                    <X className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">Remove filter</span>
                  </button>
                </li>
              ))}
            </ul>

            {activeChips.length > 1 && (
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
                Clear all
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
