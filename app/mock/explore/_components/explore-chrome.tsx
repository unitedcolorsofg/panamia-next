'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { SCOPE_TONE, type ExploreScope } from '../_data';

/**
 * The band every explore page opens with, and the facet rail under it.
 *
 * One component for all four pages rather than four near-copies, because the
 * thing being proposed is that events, groups and panas stop being *renders*
 * of the directory and start being *siblings* of it. Siblings share a house
 * style; that is what makes them recognisably the same club. What they must
 * not share is the question they ask, which is why `FacetRail` takes its rows
 * from the caller instead of holding a four-way switch in here.
 *
 * Reproduces `.dirsearch-band` exactly as it ships — eyebrow, `.dirsearch-title`,
 * `.dirsearch-count`, `.dirsearch-searchrow` — with one addition: the eyebrow
 * and the band's wash take the scope's own tone. Today all five directory
 * pages are the same indigo, so the only thing telling you which one you are
 * on is the heading text. Once these are four separate products, the page
 * should be identifiable from across the room.
 */
export function ExploreBand({
  scope,
  eyebrow,
  title,
  accent,
  count,
  field,
  actions,
}: {
  scope: ExploreScope;
  eyebrow: string;
  /** Plain text leading the headline. */
  title: ReactNode;
  /** The word that gets the accent colour, if the headline has one. */
  accent?: string;
  /** The status line under the headline. */
  count: ReactNode;
  field: ReactNode;
  /** Page-level actions — "Host an event", "Start a group". */
  actions?: ReactNode;
}) {
  return (
    <section className="dirsearch-band" data-tone={SCOPE_TONE[scope]}>
      <div className="container mx-auto px-4">
        <span
          className="section-eyebrow"
          style={{ color: 'var(--surface-tone)' }}
        >
          {eyebrow}
        </span>

        <h1 className="dirsearch-title">
          {accent ? (
            <>
              <em>{accent}</em> {title}
            </>
          ) : (
            title
          )}
        </h1>

        {/* A status line, not a heading. It reports what the page is doing
            right now, and on the live businesses view it is `role="status"`
            for exactly that reason — the count changes client-side as filters
            move, and a number that rewrites itself silently is a number a
            screen-reader user never learns changed. */}
        <p className="dirsearch-count" role="status" aria-live="polite">
          {count}
        </p>

        <div className="dirsearch-searchrow">{field}</div>

        {actions && <div className="mt-5 flex flex-wrap gap-3">{actions}</div>}
      </div>
    </section>
  );
}

export interface FacetRow {
  label: string;
  chips: string[];
  /**
   * Index of the option this facet starts on. Index 0 is treated as the
   * neutral one (All / Any / the default sort) — the control tints itself
   * only past it, which is how an applied filter is legible at a glance.
   */
  active: number;
}

/**
 * The filter rail, with facets the caller chooses — one dropdown each.
 *
 * Which facets exist is a property of the kind, not of the template. A county
 * filter means something for a business, an in-person group and an event, and
 * nothing for an online group. "This weekend" exists only for events. A craft
 * filter exists only for panas.
 *
 * Today that distinction is not made anywhere: the businesses page has four
 * facets, and the other three scopes have none at all — a pana search cannot
 * be narrowed once it has been typed. Giving each page the rows it can
 * actually answer is half of why these are separate pages at all.
 *
 * The scope row is conspicuously absent, and that absence is the proposal.
 * Scope moved into the search pill at the top of this band, so the rail is
 * free to be about the kind in front of you.
 *
 * **Dropdowns rather than chip rows.** The shipped rail spends one full row
 * per facet on a horizontally scrolling strip of chips, so four facets cost
 * four rows of sticky chrome above the first result — and because the strip
 * scrolls, the options past the fourth are invisible until you drag them into
 * view, with nothing saying they are there. Collapsing each facet to a
 * dropdown puts every facet on one row, shows the full option list when it is
 * asked for, and states the current value on the face of the control rather
 * than leaving it to be inferred from which chip is filled in.
 *
 * It also scales where the chip rail does not: the eleven categories the chip
 * row comment worries about wrapping are a normal-length menu.
 *
 * The props are unchanged from the chip version — `FacetRow.active` is now
 * read as the *initial* selection rather than a permanent one, because these
 * are real controls here. Each page mounts its own set, so changing Category
 * on the directory and then walking to events does not carry a stale pick.
 */
export function FacetRail({
  rows,
  trailing,
}: {
  rows: FacetRow[];
  /** Extra controls pinned to the end of the row — a List/Map toggle, say. */
  trailing?: ReactNode;
}) {
  // Which facet is open, by label. One at a time: two open menus overlapping
  // each other is a worse answer than the chip rail we are replacing.
  const [openLabel, setOpenLabel] = useState<string | null>(null);

  // Panels are anchored to the left of their trigger, which runs them off a
  // phone screen when the trigger is the last one in a wrapped row. Measured
  // on open rather than guessed from the index, because the rail wraps and
  // which control sits at the right edge changes with the viewport.
  const [alignRight, setAlignRight] = useState(false);

  const openFacet = (label: string, trigger: HTMLElement) => {
    const rect = trigger.getBoundingClientRect();
    const PANEL = 240; // 15rem, matching the panel width below.
    setAlignRight(rect.left + PANEL > document.documentElement.clientWidth - 16);
    setOpenLabel(label);
  };

  // Keyed by label and seeded lazily from `row.active`, so a page whose facet
  // set differs from the last one still reads its own defaults.
  const [picked, setPicked] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!openLabel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenLabel(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openLabel]);

  return (
    <div className="dirsearch-filters">
      <div className="container mx-auto px-4">
        {/* Deliberately not `.dirsearch-chiprow`. That class is
            `overflow-x: auto` — correct for a scrolling strip of chips, fatal
            for anything that hangs below one, which would be clipped at the
            strip's own edge. `flex-wrap` instead, so a narrow window stacks
            the facets rather than hiding them. */}
        <div className="relative flex flex-wrap items-center gap-2 py-0.5">
          {rows.map((row) => {
            const index = picked[row.label] ?? row.active;
            const value = row.chips[index] ?? row.chips[0];
            const open = openLabel === row.label;

            // Every one of these rails leads with a neutral option — All,
            // All of South Florida, Any, Closest — so "not index 0" is a
            // reliable read on "the visitor narrowed something", and the
            // control can carry that without a separate applied-count.
            const applied = index > 0;
            const menuId = `facet-${row.label.toLowerCase().replace(/\s+/g, '-')}`;

            return (
              <div key={row.label} className="relative">
                <button
                  type="button"
                  className="surface-pill"
                  aria-haspopup="listbox"
                  aria-expanded={open}
                  aria-controls={open ? menuId : undefined}
                  aria-label={`${row.label}: ${value}`}
                  data-applied={applied}
                  style={
                    applied
                      ? {
                          borderColor: 'var(--surface-tone)',
                          backgroundColor: 'var(--surface-tone-soft)',
                        }
                      : undefined
                  }
                  onClick={(event) =>
                    open ? setOpenLabel(null) : openFacet(row.label, event.currentTarget)
                  }
                >
                  <span className="dirsearch-filterlabel w-auto">
                    {row.label}
                  </span>
                  {/* Deliberately NOT `.surface-pill-name`. That class is
                      `display: none` under the design system's narrow
                      breakpoint, which is fine when the name is decoration
                      beside an icon — but here the value IS the control's
                      content, and hiding it leaves a phone with four pills
                      reading WHEN / WHERE / TYPE / PRICE and no way to see
                      what is actually applied. Capped and ellipsised instead,
                      so a long value shortens rather than widening the page. */}
                  <span className="max-w-[9rem] truncate font-semibold">
                    {value}
                  </span>
                  <ChevronDown
                    className="h-3.5 w-3.5 flex-none opacity-60 transition-transform"
                    style={{ transform: open ? 'rotate(180deg)' : undefined }}
                    aria-hidden="true"
                  />
                </button>

                {open && (
                  <>
                    {/* Closes on any click that is not a choice. A backdrop
                        rather than a document listener because it also stops
                        the click landing on whatever was behind it, which on
                        a results page is a card. */}
                    <button
                      type="button"
                      aria-hidden="true"
                      tabIndex={-1}
                      className="fixed inset-0 cursor-default"
                      style={{ zIndex: 44 }}
                      onClick={() => setOpenLabel(null)}
                    />

                    <div
                      id={menuId}
                      role="listbox"
                      aria-label={row.label}
                      className="surface-panel"
                      /* Same z-index reasoning as the scope menu: the sticky
                         filter strip this sits inside claims 30, so a panel
                         at the default would tie with its own container. */
                      style={{
                        top: 'calc(100% + 0.45rem)',
                        left: alignRight ? 'auto' : 0,
                        right: alignRight ? 0 : 'auto',
                        zIndex: 45,
                        width: '15rem',
                        maxWidth: 'calc(100vw - 2rem)',
                        textAlign: 'left',
                      }}
                    >
                      <p className="surface-panel-label">{row.label}</p>

                      <div className="flex flex-col gap-0.5">
                        {row.chips.map((chip, chipIndex) => {
                          const current = chipIndex === index;
                          return (
                            <button
                              key={chip}
                              type="button"
                              role="option"
                              aria-selected={current}
                              className="surface-option items-center"
                              data-current={current}
                              onClick={() => {
                                setPicked((prev) => ({
                                  ...prev,
                                  [row.label]: chipIndex,
                                }));
                                setOpenLabel(null);
                              }}
                            >
                              <span className="surface-option-name flex-1">
                                {chip}
                              </span>
                              {current && (
                                <Check
                                  className="h-4 w-4 flex-none"
                                  style={{ color: 'var(--surface-tone)' }}
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {trailing && <span className="ml-auto flex-none">{trailing}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * The line under the rail saying what the list below is actually showing.
 *
 * The band's count answers "how many are there"; this answers "how many after
 * I narrowed it". Two different numbers that the live businesses page already
 * keeps apart, and conflating them is how a page ends up claiming 340 results
 * above a list of nine.
 *
 * Utility classes rather than a `.dirsearch-*` class, deliberately. There is
 * no primitive for this line — `/mock/directory-unified` reaches for a
 * `.dirsearch-summary` that does not exist in `app/globals.css` and renders
 * unstyled as a result. Repeating that would be a mock quietly lying about
 * which parts of itself are real, which is the one thing these pages exist to
 * prevent. If this line survives review it earns a named class then.
 */
export function ResultSummary({ children }: { children: ReactNode }) {
  return (
    <div className="container mx-auto px-4 pt-6">
      <p
        className="mx-auto max-w-[58rem] text-[0.9375rem] font-bold opacity-70"
        role="status"
        aria-live="polite"
      >
        {children}
      </p>
    </div>
  );
}

/**
 * The closing band each explore page ends on.
 *
 * Every one of these pages has a second audience: the person who did not find
 * what they wanted, who is usually the person best placed to create it. The
 * directory has nothing to offer them — you cannot will a business into
 * existence from a search box — but an event and a group are both one form
 * away, so the foot of these pages is where that ask belongs.
 *
 * `.dirsearch-tail` rather than `.dirsearch-cta`: the latter is a two-column
 * grid of dashed boxes built to carry two asks side by side, and a single
 * child in it renders as one box stranded in half the width.
 */
export function ExploreTail({
  scope,
  title,
  lede,
  action,
  secondary,
}: {
  scope: ExploreScope;
  title: string;
  lede: string;
  action: string;
  secondary: string;
}) {
  return (
    <section className="dirsearch-tail" data-tone={SCOPE_TONE[scope]}>
      <div className="container mx-auto px-4">
        <span
          className="section-eyebrow"
          style={{ color: 'var(--surface-tone)' }}
        >
          Your turn
        </span>
        <h2 className="section-display">{title}</h2>
        <p className="section-lede">{lede}</p>
        <div className="dirsearch-tail-actions">
          <button type="button" className="dirsearch-tail-primary">
            {action}
          </button>
          <button type="button" className="dirsearch-chip">
            {secondary}
          </button>
        </div>
      </div>
    </section>
  );
}
