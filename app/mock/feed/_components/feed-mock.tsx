'use client';

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUp, Sparkles } from 'lucide-react';
import {
  FEED_FILTERS,
  MOCK_VIEWER,
  postsForFilter,
  type FeedFilter,
  type FeedState,
} from '../_data/mock-feed';
import { FeedComposer } from './feed-composer';
import { FeedPostCard } from './feed-post-card';
import { FeedRail } from './feed-rail';
import { FeedEmpty } from './feed-empty';
import {
  DirectoryModule,
  EventsModule,
  SuggestionsModule,
} from './feed-modules';

/* Design mock for the Pana Social feed.
 *
 * Deliberately NOT an app shell. The production feed is an embedded product
 * with its own left-hand navigation — Community, Explore, My Feed, Jams — which
 * is how you end up with a Pana Mia member looking at a page that has no Pana
 * Mia on it. This renders inside the site masthead and footer instead, so the
 * feed is a page of panamia.club rather than a different website wearing the
 * logo.
 *
 * Two columns on desktop: the timeline, and a rail of context that stacks
 * beneath it on mobile. State lives here because the filter rail drives the
 * column, and the mock's state switcher drives both. */
export function FeedMock() {
  const [filter, setFilter] = useState<FeedFilter>('panas');
  const [state, setState] = useState<FeedState>('populated');

  const posts = postsForFilter(filter);
  const activeFilter = FEED_FILTERS.find((entry) => entry.id === filter);

  return (
    <main className="surface-cream min-h-screen pb-20">
      <FeedHeader state={state} onSelectState={setState} />

      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <div className="min-w-0">
            <FeedComposer state={state} />

            {state === 'populated' ? (
              <>
                <div className="mt-6" role="tablist" aria-label="Feed filters">
                  <div className="profile-tabs">
                    {FEED_FILTERS.map((entry) => {
                      const isActive = entry.id === filter;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          role="tab"
                          id={`feed-tab-${entry.id}`}
                          aria-selected={isActive}
                          aria-controls="feed-panel"
                          className="profile-tab"
                          data-active={isActive}
                          onClick={() => setFilter(entry.id)}
                        >
                          {entry.label}
                          <span className="profile-tab-count">
                            {postsForFilter(entry.id).length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* The filter says what it is showing in a full sentence. Four
                    tabs that each need a mental model — Panas is a mutual
                    follow, Everyone is the local timeline — cannot carry that
                    in a one-word label. */}
                {activeFilter && (
                  <p className="text-pana-ink/60 mt-3 text-[13px] font-bold">
                    {activeFilter.hint}
                  </p>
                )}

                <div className="feed-new-row mt-4">
                  <button type="button" className="feed-new-pill">
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    {MOCK_VIEWER.unread} new posts
                  </button>
                </div>

                <div
                  id="feed-panel"
                  role="tabpanel"
                  aria-labelledby={`feed-tab-${filter}`}
                  className="mt-4 space-y-4"
                >
                  {posts.length > 0 ? (
                    withModules(
                      posts.map((post) => (
                        <FeedPostCard key={post.id} post={post} />
                      ))
                    )
                  ) : (
                    <FilterEmpty label={activeFilter?.label ?? ''} />
                  )}
                </div>

                {posts.length > 0 && (
                  <div className="feed-end mt-8">
                    <span>You&apos;re all caught up</span>
                  </div>
                )}
              </>
            ) : (
              <FeedEmpty />
            )}
          </div>

          <FeedRail />
        </div>

        <p className="border-pana-ink/10 text-pana-ink/55 mt-14 border-t pt-6 text-[13px] font-bold">
          Design mock at <code>/mock/feed</code> with hardcoded data. This is
          the Pana Social timeline rendered as a page of Pana Mia — inside the
          site masthead and footer, with no second navigation. It shares its
          card, tab, and stat primitives with the personal profile at{' '}
          <Link href="/mock/profile" className="link-arrow text-pana-indigo">
            /mock/profile
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </main>
  );
}

/* Modules are injected into the rendered list rather than baked into the
   fixtures, because their positions are a property of the feed — every third
   or fourth card — not of any particular post. Injecting after the fact also
   means a filter that returns two posts still gets a module, instead of
   inheriting whatever position a longer list would have used. */
function withModules(cards: ReactNode[]): ReactNode[] {
  const out: ReactNode[] = [];

  cards.forEach((card, index) => {
    out.push(card);

    if (index === 1) {
      out.push(<SuggestionsModule key="module-panas" />);
    }
    if (index === 3) {
      out.push(<EventsModule key="module-events" />);
    }
    if (index === 5) {
      out.push(<DirectoryModule key="module-directory" />);
    }
  });

  /* Short lists would otherwise end on a post with nothing after it. One
     module is the difference between "that's everything" and "that's all we
     have" — the second is the feeling the current feed gives off. */
  if (cards.length > 0 && cards.length <= 2) {
    out.push(<SuggestionsModule key="module-panas-tail" />);
  }

  return out;
}

/* Header band. Echoes the homepage: eyebrow, display heading with the italic
   second line in the counterweight colour, then a lede. The scallop bites into
   the white masthead directly above it, the same way the homepage hero does. */
function FeedHeader({
  state,
  onSelectState,
}: {
  state: FeedState;
  onSelectState: (state: FeedState) => void;
}) {
  return (
    <header
      className="scallop pt-12 pb-8"
      style={{ '--scallop': '#ffffff' } as CSSProperties}
    >
      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <span className="section-eyebrow">Pana Social</span>
            <h1 className="section-display mt-3 text-[clamp(2.25rem,5vw,3.5rem)]">
              My feed
              <br />
              <span className="display-accent">de mi gente</span>
            </h1>
            <p className="section-lede text-pana-ink/70 mt-3">
              Everything your Panas are making, asking, and showing up to this
              week — from {MOCK_VIEWER.panas.toLocaleString('en-US')} people who
              follow you back.
            </p>
          </div>

          {/* Mock-only control. Styled as developer chrome on purpose so it is
              never mistaken for part of the design under review. */}
          <div className="flex flex-none items-center gap-2">
            <span
              className="text-pana-indigo inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest uppercase"
              aria-hidden="true"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Mock
            </span>
            <div className="mock-switch">
              <button
                type="button"
                data-active={state === 'populated'}
                onClick={() => onSelectState('populated')}
              >
                Active feed
              </button>
              <button
                type="button"
                data-active={state === 'empty'}
                onClick={() => onSelectState('empty')}
              >
                New Pana
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* A filter with no posts behind it. Distinct from the new-account empty state:
   nothing is wrong here and there is nothing to set up, so it stays small and
   points back at the tab that always has something in it. */
function FilterEmpty({ label }: { label: string }) {
  return (
    <div className="reserved-slot items-start p-6">
      <p className="reserved-slot-title">Nothing under {label} right now</p>
      <p className="text-pana-ink/65 text-[13px] leading-snug font-medium">
        This filter is narrower than your whole feed, so it empties out first.
        Everyone always has something in it.
      </p>
    </div>
  );
}
