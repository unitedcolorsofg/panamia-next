'use client';

import {
  CalendarDays,
  ChevronDown,
  LayoutList,
  Map as MapIcon,
  Search,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
 * The band, the filter menus and the active-filter row.
 *
 * Everything above `.dirsearch-grid` on a directory page, reproduced from
 * `app/directory/_components/scope-page.tsx` class for class — `.surface-indigo
 * .dirsearch-band`, `.section-eyebrow`, `.dirsearch-title`, `.dirsearch-count`,
 * `.dirsearch-searchrow`, the `.directory-suggest-pill` with its scope control
 * as the leading element — then the menu row from
 * `app/directory/search/_components/filter-bar.tsx`.
 *
 * The band is reproduced for the reason `/mock/directory-unified` reproduces
 * it: the real controls navigate, and a mock whose demonstration is filtering
 * in place cannot have its first click leave the page. `FilterMenu` is
 * *imported* rather than reproduced, because that reason does not apply to it
 * — it is a controlled component that takes `selected` and `onChange` and
 * never touches the router. Copying it would give this page a lookalike free
 * to drift from the real menu, which is the opposite of what a mock built out
 * of shipping classes is for.
 *
 * Three things are different, and they are the proposal.
 *
 * **The scope pill is locked.** On `/directory/[scope]` the pill is a menu
 * because the page is one of five answers to a typed question. Here the
 * hostname already said which answer — `directory.pana.social/events` is the
 * events room, not the directory with a filter on — so the pill states the
 * scope and does not offer to change it. The chevron stays because the control
 * is the same control; it opens the other rooms rather than re-scoping a
 * query.
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
  weekendCount,
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
  weekendCount: number;
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
      <section className="surface-indigo dirsearch-band">
        <div className="container mx-auto px-4">
          <span className="section-eyebrow">Directory</span>

          <h1 className="dirsearch-title">
            What&rsquo;s on in <em>South Florida</em>
          </h1>

          <p className="dirsearch-count">
            <strong>{totalCount}</strong> events in the next 30 days ·{' '}
            <strong>{weekendCount}</strong> this weekend
          </p>

          <div className="dirsearch-searchrow">
            <form
              className="scroll-mt-24"
              onSubmit={(event) => event.preventDefault()}
            >
              <label htmlFor="mock-events-input" className="sr-only">
                Search events in the Pana Mia directory
              </label>
              <div className="directory-suggest-pill directory-suggest-pill-lead">
                <div className="relative shrink-0">
                  <button type="button" className="surface-pill">
                    <CalendarDays className="h-3.5 w-3.5 flex-none" />
                    <span className="surface-pill-name">Events</span>
                    <ChevronDown
                      className="h-3.5 w-3.5 flex-none transition-transform"
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <span className="dirsearch-chipdivide" aria-hidden="true" />

                <Search
                  className="directory-suggest-pill-icon text-pana-ink h-5 w-5 shrink-0 opacity-45"
                  aria-hidden="true"
                />

                <div className="directory-suggest-field relative w-full">
                  <div className="directory-suggest-input-shell">
                    <Input
                      id="mock-events-input"
                      type="search"
                      placeholder="Try zine fair, salsa, ceramics, Wynwood…"
                      autoComplete="off"
                      className="text-pana-ink"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="directory-suggest-pill-button"
                >
                  Search
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

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
