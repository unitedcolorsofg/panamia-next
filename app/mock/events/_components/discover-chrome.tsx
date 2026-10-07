'use client';

import { LayoutList, Map as MapIcon, X } from 'lucide-react';
import {
  FilterMenu,
  type FilterMenuOption,
} from '@/app/directory/search/_components/filter-menu';
import {
  SORT_OPTIONS,
  TYPE_CHIPS,
  WHEN_CHIPS,
  WHERE_OPTIONS,
  type EventCounty,
  type EventSort,
  type EventType,
  type WhenBucket,
} from '../_data';

export interface DayChip {
  /** Short label, e.g. "Fri 20". Matches MockEvent.day. */
  day: string;
  /** How many fixtures fall on it. Counted, not typed. */
  count: number;
}

/** How many fixtures sit behind each option, so every menu shows its own
 *  distribution. Counted by the caller off the rendered list, per the README. */
export interface FacetCounts {
  when: Record<string, number>;
  type: Record<string, number>;
  county: Record<string, number>;
}

/**
 * The calendar tab's filter menus and active-filter row.
 *
 * This is the second tab of the page, not the page. It used to be the whole
 * thing — a search band, five facets and a chronological list — which is a
 * directory results page with events in it rather than a discover page: it
 * requires the viewer to already know what they want and merely narrow to it.
 * The spine is now the reason lanes in `events-discover.tsx`, and this is what
 * is left for the viewer who genuinely does know, and wants Saturday.
 *
 * It no longer carries a band or a search box. The band became the page's own,
 * holding the one availability control and the tabs; the search box went
 * because a text query over events is what `/directory/events` already is, and
 * reproducing it here was most of what made this read as a search page. What
 * remains is the menu row from
 * `app/directory/search/_components/filter-bar.tsx`.
 *
 * `FilterMenu` is *imported* rather than reproduced. The README reproduces
 * real controls because real controls navigate, and a mock whose demonstration
 * is filtering in place cannot have its first click leave the page — but that
 * reason does not apply to a controlled component that takes `selected` and
 * `onChange` and never touches the router. Copying it would give this page a
 * lookalike free to drift from the real menu, which is the opposite of what a
 * mock built out of shipping classes is for.
 *
 * Two things are different, and they are the proposal.
 *
 * **There is a Dates menu**, which is the one affordance a search page
 * genuinely cannot supply. Searching requires a word, and "Saturday" is not a
 * word about an event — it is the whole question for most of the people
 * arriving.
 *
 * **Every option carries its count.** This is what the menus bought. As five
 * chip rails there was no room for a number beside each chip without wrapping
 * to a second line, so only the dates had one; folded into menus, each option
 * gets a full row and the count comes free. It matters more than it sounds:
 * the failure mode of every date picker is rendering all days alike, and the
 * failure mode of every category filter is offering a term that returns
 * nothing. A count beside the option fixes both before the click.
 */
export function DiscoverChrome({
  when,
  onWhen,
  day,
  onDay,
  types,
  onTypes,
  counties,
  onCounties,
  sort,
  onSort,
  days,
  counts,
  totalCount,
  shownCount,
}: {
  when: WhenBucket | 'all';
  onWhen: (next: WhenBucket | 'all') => void;
  day: string | null;
  onDay: (next: string | null) => void;
  types: EventType[];
  onTypes: (next: EventType[]) => void;
  counties: EventCounty[];
  onCounties: (next: EventCounty[]) => void;
  sort: EventSort;
  onSort: (next: EventSort) => void;
  days: DayChip[];
  counts: FacetCounts;
  totalCount: number;
  shownCount: number;
}) {
  const filtered = shownCount !== totalCount;

  /* Counts are hints rather than part of the label so the option still reads
     as a place or a day first. `FilterMenu` puts them on a second line. */
  const plural = (n: number) => `${n} event${n === 1 ? '' : 's'}`;

  const whenOptions: FilterMenuOption[] = WHEN_CHIPS.map((chip) => ({
    value: chip.key,
    label: chip.label,
    hint: plural(counts.when[chip.key] ?? 0),
  }));

  const dayOptions: FilterMenuOption[] = days.map((chip) => ({
    value: chip.day,
    label: chip.day,
    hint: plural(chip.count),
  }));

  const typeOptions: FilterMenuOption[] = TYPE_CHIPS.map((chip) => ({
    value: chip.key,
    label: chip.label,
    hint: plural(counts.type[chip.key] ?? 0),
  }));

  const whereOptions: FilterMenuOption[] = WHERE_OPTIONS.map((option) => ({
    value: option.key,
    label: option.label,
    hint: option.needsLocation
      ? undefined
      : plural(counts.county[option.key] ?? 0),
    disabledReason: option.needsLocation
      ? 'Share your location first'
      : undefined,
  }));

  const sortOptions: FilterMenuOption[] = SORT_OPTIONS.map((option) => ({
    value: option.key,
    label: option.label,
    disabledReason: option.needsLocation
      ? 'Share your location first'
      : undefined,
  }));

  /* Every active choice repeated as one removable chip, which is the trade the
     real filter bar makes and the reason folding the rails up is not a loss:
     what is on stays on the page, and turning one off never requires opening
     a menu first. */
  const activeChips: { key: string; label: string; clear: () => void }[] = [
    ...(when !== 'all'
      ? [
          {
            key: `when:${when}`,
            label:
              WHEN_CHIPS.find((chip) => chip.key === when)?.label ??
              String(when),
            clear: () => onWhen('all'),
          },
        ]
      : []),
    ...(day !== null
      ? [{ key: `day:${day}`, label: day, clear: () => onDay(null) }]
      : []),
    ...types.map((value) => ({
      key: `type:${value}`,
      label: TYPE_CHIPS.find((chip) => chip.key === value)?.label ?? value,
      clear: () => onTypes(types.filter((item) => item !== value)),
    })),
    ...counties.map((value) => ({
      key: `county:${value}`,
      label:
        WHERE_OPTIONS.find((option) => option.key === value)?.label ?? value,
      clear: () => onCounties(counties.filter((item) => item !== value)),
    })),
  ];

  return (
    <>
      <div className="dirsearch-filters">
        <div className="dirsearch-filterinner dirsearch-filterinner--menus container mx-auto">
          <div className="dirsearch-menurow">
            {/* When and Dates are two resolutions of one axis, so they sit
                adjacent and clear each other: picking Saturday means the window
                is Saturday, not "this weekend, and also Saturday". As chip
                rails this could be faked by un-lighting the When row, but a
                menu trigger names its own state — it would have gone on
                reading "Later this month" while a Tuesday was doing the
                filtering — so here the clearing has to be real. */}
            <FilterMenu
              label="When"
              options={whenOptions}
              selected={[day === null ? when : 'all']}
              single
              defaultValue="all"
              onChange={([next]) => {
                onDay(null);
                onWhen(next as WhenBucket | 'all');
              }}
            />

            <FilterMenu
              label="Dates"
              options={dayOptions}
              selected={day === null ? [] : [day]}
              single
              caption="One day at a time. Picking one replaces the window above."
              onChange={([next]) => {
                onWhen('all');
                onDay(next ?? null);
              }}
            />

            {/* Type is multi-select where When and Sort are not. Markets and
                workshops are not alternatives to each other — a person free on
                Saturday will take either — whereas two windows or two orders
                cannot both be true. */}
            <FilterMenu
              label="Type"
              options={typeOptions}
              selected={types}
              onChange={(next) => onTypes(next as EventType[])}
            />

            <FilterMenu
              label="Where"
              options={whereOptions}
              selected={counties}
              onChange={(next) => onCounties(next as EventCounty[])}
            />

            <FilterMenu
              label="Sort"
              options={sortOptions}
              selected={[sort]}
              single
              defaultValue="soonest"
              onChange={([next]) => onSort(next as EventSort)}
            />

            <div className="dirsearch-viewtoggle">
              <button type="button" data-on={true} aria-pressed={true}>
                <LayoutList className="h-4 w-4" aria-hidden="true" />
                List
              </button>
              <button type="button" data-on={false} aria-pressed={false}>
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
                  onClick={() => {
                    onWhen('all');
                    onDay(null);
                    onTypes([]);
                    onCounties([]);
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 pt-6">
        <p className="dirsearch-summary" role="status" aria-live="polite">
          <strong>{shownCount}</strong> {shownCount === 1 ? 'event' : 'events'}
          {filtered
            ? shownCount === 1
              ? ' matches these filters'
              : ' match these filters'
            : ' coming up'}
        </p>
      </div>
    </>
  );
}
