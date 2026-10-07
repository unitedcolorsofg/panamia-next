'use client';

import {
  CalendarDays,
  ChevronDown,
  List,
  Map as MapIcon,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  SORT_CHIPS,
  TYPE_CHIPS,
  WHEN_CHIPS,
  WHERE_CHIPS,
  type EventType,
  type WhenBucket,
} from '../_data';

export interface DayChip {
  /** Short label, e.g. "Fri 20". Matches MockEvent.day. */
  day: string;
  /** How many fixtures fall on it. Counted, not typed. */
  count: number;
}

/**
 * The band, the date strip and the facet rail.
 *
 * Everything above `.dirsearch-grid` on a directory page, reproduced from
 * `app/directory/_components/scope-page.tsx` class for class — `.surface-indigo
 * .dirsearch-band`, `.section-eyebrow`, `.dirsearch-title`, `.dirsearch-count`,
 * `.dirsearch-searchrow`, the `.directory-suggest-pill` with its scope control
 * as the leading element, then `.dirsearch-filters` with one
 * `.dirsearch-filterrow` per facet. Reproduced rather than imported for the
 * same reason `/mock/directory-unified` reproduces it: the real controls
 * navigate, and a mock whose demonstration is filtering in place cannot have
 * its first click leave the page.
 *
 * Two things are different, and they are the proposal.
 *
 * **The scope pill is locked.** On `/directory/[scope]` the pill is a menu
 * because the page is one of five answers to a typed question. Here the
 * hostname already said which answer — `directory.pana.social/events` is the
 * events room, not the directory with a filter on — so the pill states the
 * scope and does not offer to change it. The chevron stays because the control
 * is the same control; it opens the other rooms rather than re-scoping a
 * query.
 *
 * **There is a date strip**, carried as an ordinary `.dirsearch-filterrow` so
 * it inherits the rail's grammar rather than inventing a calendar widget. This
 * is the one affordance a search page genuinely cannot supply. Searching
 * requires a word, and "Saturday" is not a word about an event — it is the
 * whole question for most of the people arriving. Each chip carries its own
 * count, so an empty Tuesday is visible before it is clicked, which is the
 * failure mode of every date picker that renders all days alike.
 */
export function DiscoverChrome({
  when,
  onWhen,
  day,
  onDay,
  types,
  onToggleType,
  days,
  totalCount,
  shownCount,
  weekendCount,
}: {
  when: WhenBucket | 'all';
  onWhen: (next: WhenBucket | 'all') => void;
  day: string | null;
  onDay: (next: string | null) => void;
  types: EventType[];
  onToggleType: (next: EventType) => void;
  days: DayChip[];
  totalCount: number;
  shownCount: number;
  weekendCount: number;
}) {
  const filtered = shownCount !== totalCount;

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
        <div className="container mx-auto px-4">
          {/* When and Dates are two resolutions of one axis, so they sit
              adjacent and clear each other: picking Saturday means the window
              is Saturday, not "this weekend, and also Saturday". Keeping them
              independent produced the state nobody could read — two controls
              both lit, describing different windows. */}
          <div className="dirsearch-filterrow">
            <span className="dirsearch-filterlabel">When</span>
            <div className="dirsearch-chiprow">
              {WHEN_CHIPS.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="dirsearch-chip inline-flex items-center gap-1.5"
                  data-on={day === null && when === chip.key}
                  onClick={() => {
                    onDay(null);
                    onWhen(chip.key);
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dirsearch-filterrow">
            <span className="dirsearch-filterlabel">Dates</span>
            <div className="dirsearch-chiprow">
              {days.map((chip) => (
                <button
                  key={chip.day}
                  type="button"
                  className="dirsearch-chip inline-flex items-center gap-1.5"
                  data-on={day === chip.day}
                  onClick={() => onDay(day === chip.day ? null : chip.day)}
                >
                  {chip.day}
                  <span className="opacity-55">{chip.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Type is multi-select where the rest of the rail is not. Markets
              and workshops are not alternatives to each other — a person free
              on Saturday will take either — whereas two sorts or two windows
              cannot both be true. */}
          <div className="dirsearch-filterrow">
            <span className="dirsearch-filterlabel">Type</span>
            <div className="dirsearch-chiprow">
              {TYPE_CHIPS.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="dirsearch-chip inline-flex items-center gap-1.5"
                  data-on={types.includes(chip.key)}
                  aria-pressed={types.includes(chip.key)}
                  onClick={() => onToggleType(chip.key)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dirsearch-filterrow">
            <span className="dirsearch-filterlabel">Where</span>
            <div className="dirsearch-chiprow">
              {WHERE_CHIPS.map((chip, index) => (
                <button
                  key={chip}
                  type="button"
                  className="dirsearch-chip inline-flex items-center gap-1.5"
                  data-on={index === 0}
                >
                  {chip}
                </button>
              ))}
              {/* List/Map is a view mode, not a fifth place. It shares the Where
                  row because choosing a map is how you ask a question about
                  place, but the rule separates it so the row does not read as
                  five mutually exclusive location chips. */}
              <span
                aria-hidden="true"
                className="bg-pana-ink/15 mx-1 h-5 w-px self-center"
              />
              <button
                type="button"
                className="dirsearch-chip inline-flex items-center gap-1.5"
                data-on={true}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                List
              </button>
              <button
                type="button"
                className="dirsearch-chip inline-flex items-center gap-1.5"
                data-on={false}
              >
                <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Map
              </button>
            </div>
          </div>

          <div className="dirsearch-filterrow">
            <span className="dirsearch-filterlabel">Sort</span>
            <div className="dirsearch-chiprow">
              {SORT_CHIPS.map((chip, index) => (
                <button
                  key={chip}
                  type="button"
                  className="dirsearch-chip inline-flex items-center gap-1.5"
                  data-on={index === 0}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
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
