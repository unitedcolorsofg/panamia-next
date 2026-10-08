import type { ReactNode } from 'react';

import { ADMIN_CHROME } from '@/lib/admin/theme';

/**
 * Shared furniture for the admin views.
 *
 * These are the same shapes as the connectors dashboard parts, drawn in the
 * admin chrome instead. They are not imported from there because those read
 * `CONNECTORS_CHROME` directly and bake `text-pana-cream/60` into the stat
 * band — correct on indigo, invisible on a light blue fill. Parameterising
 * components that already shipped, to serve a mock, is the more expensive
 * mistake of the two.
 *
 * All server components. Nothing here needs a client bundle — which is why
 * `StatusPill` sits in its own file: the sidebar is a client component and
 * imports it, and pulling these two in alongside it would be a cost paid by
 * every admin page for furniture the sidebar never renders.
 */

/** A bordered panel with a solid header bar. The basic unit of a view. */
export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border-2 border-pana-ink ${ADMIN_CHROME.SURFACE} ${className}`}
    >
      <header
        className={`flex items-center justify-between gap-4 ${ADMIN_CHROME.FILL} px-5 py-3`}
      >
        <h2
          className={`text-sm font-extrabold uppercase tracking-wide ${ADMIN_CHROME.ON_FILL}`}
        >
          {title}
        </h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export interface BandStat {
  label: string;
  value: string;
  note: string;
}

/**
 * The band of headline numbers.
 *
 * One strip divided by rules rather than five cards, because these are five
 * readings of one queue and not five unrelated facts.
 */
export function StatBand({ stats }: { stats: readonly BandStat[] }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border-2 border-pana-ink ${ADMIN_CHROME.FILL}`}
    >
      <dl
        className={`grid ${ADMIN_CHROME.DIVIDE} divide-y-2 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5`}
      >
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`px-5 py-4 ${
              index > 0 ? `lg:border-l-2 ${ADMIN_CHROME.RULE_LG}` : ''
            }`}
          >
            <dd
              className={`text-4xl font-extrabold leading-none ${ADMIN_CHROME.ACCENT}`}
            >
              {stat.value}
            </dd>
            <dt className={`mt-2 text-sm font-bold ${ADMIN_CHROME.ON_FILL}`}>
              {stat.label}
            </dt>
            {/* Ink, not cream. The fill is light — see lib/admin/theme.ts. */}
            <p className="text-xs text-pana-ink/70">{stat.note}</p>
          </div>
        ))}
      </dl>
    </div>
  );
}
