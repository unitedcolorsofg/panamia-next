'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ADMIN_CHROME } from '@/lib/admin/theme';
import { ADMIN_GROUPS, ADMIN_VIEWS, type AdminView } from '@/lib/admin/views';

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
 */

function NavLink({ view, active }: { view: AdminView; active: boolean }) {
  return (
    <Link
      href={view.href}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex items-center justify-between gap-2 whitespace-nowrap rounded px-3 py-2 text-sm transition-colors',
        active
          ? `${ADMIN_CHROME.FILL} ${ADMIN_CHROME.ON_FILL} font-semibold`
          : 'text-pana-ink/70 hover:bg-pana-ink/5 hover:text-pana-ink',
      ].join(' ')}
    >
      <span>{view.name}</span>
      {view.status !== 'live' && (
        <span
          className={[
            'rounded px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide',
            active ? 'bg-pana-ink/15 text-pana-ink' : 'bg-pana-ink/10 text-pana-ink/60',
          ].join(' ')}
        >
          {view.status}
        </span>
      )}
    </Link>
  );
}

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="lg:w-56 lg:shrink-0">
      <div className="flex gap-6 overflow-x-auto pb-3 lg:block lg:gap-0 lg:overflow-visible lg:pb-0">
        <div className="lg:mb-6">
          <p
            className={`hidden pb-2 text-xs font-bold uppercase tracking-wide lg:block ${ADMIN_CHROME.ACCENT}`}
          >
            Admin
          </p>
          <ul className="flex gap-2 lg:flex-col lg:gap-1">
            <li>
              <NavLink
                view={{
                  id: 'overview',
                  name: 'Overview',
                  href: '/admin',
                  group: 'directory',
                  blurb: '',
                  does: [],
                  status: 'live',
                }}
                active={pathname === '/admin'}
              />
            </li>
          </ul>
        </div>

        {ADMIN_GROUPS.map((group) => {
          const views = ADMIN_VIEWS.filter((v) => v.group === group.id);
          if (views.length === 0) return null;
          return (
            <div key={group.id} className="lg:mb-6">
              <p
                className={`hidden pb-2 text-xs font-bold uppercase tracking-wide lg:block ${ADMIN_CHROME.ACCENT}`}
              >
                {group.name}
              </p>
              <ul className="flex gap-2 lg:flex-col lg:gap-1">
                {views.map((view) => (
                  <li key={view.id}>
                    <NavLink view={view} active={pathname === view.href} />
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
