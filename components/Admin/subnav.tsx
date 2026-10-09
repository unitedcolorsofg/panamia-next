import Link from 'next/link';

import { ADMIN_CHROME } from '@/lib/admin/theme';

/**
 * A strip of tabs across a set of related admin pages.
 *
 * The sidebar already lists every tool, so this is not navigation in the sense
 * of finding something — it is for the moving back and forth that happens
 * inside one job. Deciding on an application and then scheduling the person
 * you just let in is one piece of work across two pages, and making that a
 * round trip through the sidebar puts the whole tool list between two halves
 * of the same thought.
 *
 * ## Why `active` is a prop and not a pathname read
 *
 * `usePathname` would make this a client component, and it is rendered by
 * server pages that otherwise ship no JavaScript. Every caller already knows
 * which page it is — it *is* that page — so the one fact needed is the one
 * fact passed in.
 *
 * The sidebar cannot do this: it is rendered once in the layout and genuinely
 * does not know, which is why it reads the pathname and pays for the client
 * bundle.
 */

export interface SubNavTab {
  id: string;
  name: string;
  href: string;
  /**
   * A number worth seeing before you click, such as a queue depth.
   *
   * Only rendered when it is greater than zero. A badge reading "0" is noise
   * that looks like information — the useful signal is a queue having
   * something in it, and an empty one says that best by being quiet.
   */
  count?: number;
}

export function AdminSubNav({
  tabs,
  active,
  label,
}: {
  tabs: readonly SubNavTab[];
  /** The `id` of the tab for the page doing the rendering. */
  active: string;
  /** Names the set for screen readers: "Connectors pages". */
  label: string;
}) {
  return (
    <nav aria-label={label} className="pb-6">
      <ul
        className={`border-pana-ink flex gap-1 overflow-x-auto rounded-xl border-2 p-1 ${ADMIN_CHROME.SURFACE}`}
      >
        {tabs.map((tab) => {
          const current = tab.id === active;
          return (
            <li key={tab.id} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={current ? 'page' : undefined}
                className={[
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm whitespace-nowrap transition-colors',
                  current
                    ? `${ADMIN_CHROME.FILL} ${ADMIN_CHROME.ON_FILL} font-extrabold`
                    : 'text-pana-ink/70 hover:bg-pana-ink/5 hover:text-pana-ink font-bold',
                ].join(' ')}
              >
                {tab.name}
                {tab.count !== undefined && tab.count > 0 && (
                  /* Ink on butter at 16.41 — the one warm chip that is safe on
                   * both states of the tab, so the badge does not have to
                   * change colour when the tab underneath it fills. */
                  <span className="bg-pana-butter text-pana-ink rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums">
                    {tab.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
