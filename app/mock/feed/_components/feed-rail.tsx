import Image from 'next/image';
import { ArrowRight, Hash, Sparkles } from 'lucide-react';
import {
  MOCK_TRENDING,
  MOCK_VIEWER,
  RESERVED_MODULES,
} from '../_data/mock-feed';

/* The rail beside the timeline.
 *
 * Not navigation — the site masthead already owns that, and the whole point of
 * this mock is that Pana Social lives inside Pana Mia rather than behind its
 * own app shell. Everything here is context for the column next to it, so it
 * stacks underneath the feed on narrow screens instead of collapsing into a
 * drawer. */
export function FeedRail() {
  return (
    <aside className="feed-rail space-y-5">
      <section className="profile-card p-4">
        <div className="flex items-center gap-3">
          <div className="border-pana-ink/10 relative h-11 w-11 flex-none overflow-hidden rounded-full border-2">
            <Image
              src={MOCK_VIEWER.avatar}
              alt=""
              fill
              sizes="44px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] leading-tight font-extrabold">
              {MOCK_VIEWER.name}
            </p>
            <p className="text-pana-ink/45 truncate text-[13px] font-bold">
              @{MOCK_VIEWER.handle}
            </p>
          </div>
        </div>

        {/* Same stat rail the profile uses, so the two surfaces never disagree
            about how many Panas somebody has. */}
        <div className="stat-rail mt-3.5">
          <div className="stat-rail-item">
            <span className="stat-rail-value">
              {MOCK_VIEWER.panas.toLocaleString('en-US')}
            </span>
            <span className="stat-rail-label">Panas</span>
          </div>
          <div className="stat-rail-item">
            <span className="stat-rail-value">{MOCK_VIEWER.groups}</span>
            <span className="stat-rail-label">Groups</span>
          </div>
          <div className="stat-rail-item">
            <span className="stat-rail-value">{MOCK_VIEWER.unread}</span>
            <span className="stat-rail-label">Unread</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="rail-trending">
        <h2 id="rail-trending" className="rail-heading">
          Trending in Miami-Dade
        </h2>
        <ul className="mt-2.5 space-y-1">
          {MOCK_TRENDING.map((entry) => (
            <li key={entry.tag}>
              <button
                type="button"
                className="hover:bg-pana-butter/50 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors"
              >
                <Hash
                  className="text-pana-burnt h-3.5 w-3.5 flex-none"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold">
                  {entry.tag}
                </span>
                <span className="text-pana-ink/45 flex-none text-[12px] font-bold">
                  {entry.posts}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Held-open space, same treatment as the profile mock: designed in now
          so the rail does not have to be re-laid-out when these land. */}
      <section aria-labelledby="rail-reserved">
        <h2 id="rail-reserved" className="rail-heading">
          Coming to the feed
        </h2>
        <div className="mt-2.5 space-y-2.5">
          {RESERVED_MODULES.map((module) => (
            <div key={module.title} className="reserved-slot p-3.5">
              <p className="reserved-slot-title inline-flex items-center gap-1.5 text-[14px]">
                <Sparkles
                  className="text-pana-indigo h-3.5 w-3.5"
                  aria-hidden="true"
                />
                {module.title}
              </p>
              <p className="text-pana-ink/65 text-[12px] leading-snug font-medium">
                {module.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-pana-ink/45 text-[12px] leading-snug font-bold">
        Pana Social is part of Pana Mia, not a separate app.{' '}
        <span className="link-arrow text-pana-indigo">
          About the network
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </span>
      </p>
    </aside>
  );
}
