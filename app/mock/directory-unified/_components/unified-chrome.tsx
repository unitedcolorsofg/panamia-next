'use client';

import { Map as MapIcon, List, Search } from 'lucide-react';
import { KIND_ICON } from '@/components/kind-icon';
import type { SuggestionKind } from '@/lib/suggest';
import { UNIFIED_COUNTS } from '../_data';

export type MockScope = 'all' | SuggestionKind;

const SCOPE_ORDER: MockScope[] = ['all', 'business', 'pana', 'group', 'event'];

const SCOPE_LABEL: Record<MockScope, string> = {
  all: 'Everything',
  business: 'Businesses',
  pana: 'Panas',
  group: 'Groups',
  event: 'Events',
};

/**
 * Facets are per scope because they are per kind, not per page.
 *
 * The live Businesses view shows CATEGORY, WHERE, SORT and a List/Map toggle;
 * the live scope views show none of them. Both are wrong in the same way —
 * they treat the facet rail as a property of which template rendered, when it
 * is really a property of what is being filtered. A county filter is
 * meaningful for a business, a pana and a group meetup and meaningless for an
 * online group; a map needs coordinates, which events and businesses have and
 * panas mostly do not; "this weekend" only exists for events.
 *
 * So the rail is declared here, once, and each scope takes the rows it can
 * answer. Everything takes the intersection — the two rows that mean the same
 * thing for all four kinds — rather than showing a Category chip that would
 * silently drop every pana from the results.
 */
const FACETS: Record<MockScope, string[]> = {
  all: ['WHERE', 'SORT'],
  business: ['CATEGORY', 'WHERE', 'SORT'],
  pana: ['INTERESTS', 'WHERE', 'SORT'],
  group: ['TAGS', 'WHERE', 'SORT'],
  event: ['TAGS', 'WHEN', 'WHERE', 'SORT'],
};

const CHIPS: Record<string, string[]> = {
  CATEGORY: ['Food', 'Products', 'Services', 'Venues', 'Art'],
  INTERESTS: ['Ceramics', 'Music', 'Film', 'Teaching'],
  TAGS: ['Zines', 'Print', 'Free', 'Open to all'],
  WHEN: ['Today', 'This weekend', 'This month'],
  WHERE: ['Near me', 'Miami-Dade', 'Broward', 'Palm Beach'],
  SORT: ['Best match', 'Closest', 'Newest'],
};

/** Map only makes sense where the things have addresses. */
const HAS_MAP: Record<MockScope, boolean> = {
  all: false,
  business: true,
  pana: false,
  group: false,
  event: true,
};

/**
 * The summary is a sentence, so it has to count like one. The live Businesses
 * page hardcodes " businesses" and is wrong at one result for the same
 * reason; a merged view that renders all four kinds would be wrong four ways.
 */
const NOUN: Record<MockScope, [singular: string, plural: string]> = {
  all: ['result', 'results'],
  business: ['business', 'businesses'],
  pana: ['pana', 'panas'],
  group: ['group', 'groups'],
  event: ['event', 'events'],
};

export function UnifiedChrome({
  scope,
  onScope,
  resultCount,
}: {
  scope: MockScope;
  onScope: (next: MockScope) => void;
  resultCount: number;
}) {
  const noun = NOUN[scope][resultCount === 1 ? 0 : 1];

  return (
    <>
      {/* The compact toolbar from the Businesses view, now used by every
          scope. The scope views currently open with the pre-#206 hero band —
          an eyebrow, a display headline, a count and a full-bleed drawing,
          roughly 570px before the first result. That band was deliberately
          removed from Businesses because the directory is a page you refine
          five times in a row, and every refinement paid for the hero again.
          Panas, groups and events are refined the same way. */}
      <section className="dirsearch-tools">
        <form
          className="dirsearch-searchrow"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor="mock-unified-input" className="sr-only">
            Search the Pana Mia directory
          </label>
          <div className="dirsearch-pill">
            <Search
              className="h-5 w-5 shrink-0 opacity-45"
              aria-hidden="true"
            />
            <input
              id="mock-unified-input"
              type="search"
              defaultValue="art"
              placeholder="Try food, art, Hialeah, bike repair…"
              autoComplete="off"
            />
            <button type="submit">Search</button>
          </div>
        </form>

        <div className="dirsearch-toolsline">
          <h1 className="sr-only">Find your people</h1>
          <p className="dirsearch-summary" role="status" aria-live="polite">
            <strong>{resultCount}</strong> {noun} for <em>art</em>
          </p>
        </div>
      </section>

      {/* Scope chips keep the icons the typeahead and scope menu already use,
          so a kind is the same symbol everywhere it appears. */}
      <section className="dirsearch-filters">
        <div className="dirsearch-filterinner">
          <div className="dirsearch-filterrow">
            <span className="dirsearch-filterlabel">SHOW</span>
            <div className="dirsearch-chiprow">
              {SCOPE_ORDER.map((option) => {
                const Icon =
                  option === 'all' ? null : KIND_ICON[option as SuggestionKind];
                const count =
                  option === 'all'
                    ? Object.values(UNIFIED_COUNTS).reduce((a, b) => a + b, 0)
                    : UNIFIED_COUNTS[option as SuggestionKind];
                return (
                  <button
                    key={option}
                    type="button"
                    className="dirsearch-chip"
                    data-on={option === scope}
                    onClick={() => onScope(option)}
                  >
                    {Icon && (
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {SCOPE_LABEL[option]}
                    <span className="opacity-55">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {FACETS[scope].map((row) => (
            <div key={row} className="dirsearch-filterrow">
              <span className="dirsearch-filterlabel">{row}</span>
              <div className="dirsearch-chiprow">
                {CHIPS[row].map((chip, index) => (
                  <button
                    key={chip}
                    type="button"
                    className="dirsearch-chip"
                    data-on={row === 'SORT' && index === 0}
                  >
                    {chip}
                  </button>
                ))}
                {row === 'WHERE' && HAS_MAP[scope] && (
                  <span className="ml-auto inline-flex gap-1">
                    <button
                      type="button"
                      className="dirsearch-chip"
                      data-on={true}
                    >
                      <List className="h-3.5 w-3.5" aria-hidden="true" />
                      List
                    </button>
                    <button
                      type="button"
                      className="dirsearch-chip"
                      data-on={false}
                    >
                      <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      Map
                    </button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
