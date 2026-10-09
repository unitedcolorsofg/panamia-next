import type { SubNavTab } from '@/components/Admin/subnav';

/**
 * The Connectors admin pages, as data.
 *
 * One list so the three pages cannot disagree about what the set contains or
 * what order it is in — the tab strip is rendered by each page separately, and
 * a hand-written copy per page is three places for a renamed route to rot.
 *
 * Mirrors `lib/admin/views.ts` in spirit, but is deliberately not part of it.
 * `ADMIN_VIEWS` drives the sidebar and the overview, which describe tools to
 * somebody deciding where to go. This describes one tool's own internal
 * structure to somebody already inside it, and the two answer to different
 * things: a page could reasonably appear here and not there, or carry a queue
 * count here that the sidebar has no business fetching.
 *
 * Dependency-free apart from the tab type, so a server page can read it
 * without dragging anything into its bundle.
 */

export type ConnectorsTabId = 'overview' | 'applications' | 'scheduling';

export function connectorsTabs(pendingCount: number): readonly SubNavTab[] {
  return [
    {
      id: 'overview',
      name: 'Overview',
      href: '/admin/connectors',
    },
    {
      id: 'applications',
      name: 'Applications',
      href: '/admin/connectors/applications',
      /* The one number worth carrying into the strip: an application sitting
       * undecided is a person waiting on an answer, and it is the only state
       * here that gets worse on its own. */
      count: pendingCount,
    },
    {
      id: 'scheduling',
      name: 'Scheduling',
      href: '/admin/connectors/scheduling',
    },
  ];
}
