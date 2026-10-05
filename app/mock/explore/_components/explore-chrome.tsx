'use client';

import type { ReactNode } from 'react';
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
  /** Index of the chip that reads as on. -1 for a row with nothing applied. */
  active: number;
}

/**
 * The filter rail, with rows the caller chooses.
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
 */
export function FacetRail({
  rows,
  trailing,
}: {
  rows: FacetRow[];
  /** Extra controls pinned to the last row — a List/Map toggle, say. */
  trailing?: ReactNode;
}) {
  return (
    <div className="dirsearch-filters">
      <div className="container mx-auto px-4">
        {rows.map((row, rowIndex) => (
          <div key={row.label} className="dirsearch-filterrow">
            <span className="dirsearch-filterlabel">{row.label}</span>
            <div className="dirsearch-chiprow">
              {row.chips.map((chip, index) => (
                <button
                  key={chip}
                  type="button"
                  className="dirsearch-chip inline-flex items-center gap-1.5"
                  data-on={index === row.active}
                >
                  {chip}
                </button>
              ))}
              {trailing && rowIndex === rows.length - 1 ? trailing : null}
            </div>
          </div>
        ))}
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
