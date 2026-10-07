'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, type LucideIcon } from 'lucide-react';

import { StatusPill } from '@/components/Admin/status-pill';
import { ADMIN_CHROME } from '@/lib/admin/theme';
import {
  ADMIN_GROUPS,
  adminGroup,
  viewsInGroup,
  type AdminView,
} from '@/lib/admin/views';

/**
 * The admin surface's navigation.
 *
 * Replaces the old `AdminMenu` strip, which was a wrapping row of black pills
 * that needed two rows at 1280px and four at 430px. A row that grows sideways
 * gets worse with every tool added; a column does not, which is the whole
 * reason this is a sidebar.
 *
 * Active state is an exact pathname match rather than a prefix match on
 * purpose: `/admin` is a prefix of every other route here, so prefix matching
 * would light up Overview on every page.
 *
 * ## The icons are not decoration
 *
 * Nine links of similar length in one column are nine identical shapes, and
 * the only way to tell them apart is to read all nine. Each one now carries
 * its view's icon on a chip in its group's colour, so the column can be
 * navigated by position and colour the way a toolbar is — which is what
 * someone who opens this every day actually does.
 *
 * Below `lg` this is still a horizontal strip, because a sidebar on a phone is
 * either a drawer behind a tap or a column that pushes the work off-screen.
 * The strip is 63px tall against the old menu's 244px, and it scrolls rather
 * than wraps, so it stays one row however many tools get added.
 */

function NavLink({
  view,
  active,
  fill,
  onFill,
}: {
  view: AdminView;
  active: boolean;
  fill: string;
  onFill: string;
}) {
  const Icon = view.icon;

  return (
    <Link
      href={view.href}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm transition-colors',
        active
          ? `${ADMIN_CHROME.FILL} ${ADMIN_CHROME.ON_FILL} font-bold`
          : 'font-medium text-pana-ink/75 hover:bg-pana-ink/5 hover:text-pana-ink',
      ].join(' ')}
    >
      {/* On the active row the chip drops its own colour. The row is already
          filled with the surface blue, and a second fill inside it reads as a
          button inside a button. */}
      <span
        aria-hidden="true"
        className={[
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
          active ? 'bg-pana-ink/15 text-pana-ink' : `${fill} ${onFill}`,
        ].join(' ')}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1">{view.name}</span>
      <StatusPill status={view.status} />
    </Link>
  );
}

/* The overview is not in ADMIN_VIEWS — it is the page listing them, not one of
   them — so its nav row is built here. It borrows the Directory colour rather
   than inventing a fifth, since it is the shelf it sits above. */
const OVERVIEW: AdminView = {
  id: 'overview',
  name: 'Overview',
  href: '/admin',
  group: 'directory',
  blurb: '',
  does: [],
  status: 'live',
  icon: LayoutGrid as LucideIcon,
};

function GroupLabel({ children }: { children: string }) {
  return (
    <p
      className={`hidden pb-1.5 pl-1 text-[0.6875rem] font-black uppercase tracking-[0.14em] lg:block ${ADMIN_CHROME.ACCENT}`}
    >
      {children}
    </p>
  );
}

export default function AdminNav() {
  const pathname = usePathname();
  const directory = adminGroup('directory');

  return (
    <nav aria-label="Admin sections" className="lg:w-60 lg:shrink-0">
      <div className="flex gap-5 overflow-x-auto pb-3 lg:block lg:gap-0 lg:overflow-visible lg:pb-0">
        <div className="lg:mb-5">
          <GroupLabel>Admin</GroupLabel>
          <ul className="flex gap-1.5 lg:flex-col lg:gap-0.5">
            <li>
              <NavLink
                view={OVERVIEW}
                active={pathname === '/admin'}
                fill={directory.fill}
                onFill={directory.onFill}
              />
            </li>
          </ul>
        </div>

        {ADMIN_GROUPS.map((group) => {
          const views = viewsInGroup(group.id);
          if (views.length === 0) return null;
          return (
            <div key={group.id} className="lg:mb-5">
              <GroupLabel>{group.name}</GroupLabel>
              <ul className="flex gap-1.5 lg:flex-col lg:gap-0.5">
                {views.map((view) => (
                  <li key={view.id}>
                    <NavLink
                      view={view}
                      active={pathname === view.href}
                      fill={group.fill}
                      onFill={group.onFill}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
