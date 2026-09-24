'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  Compass,
  MessageCircle,
  PenLine,
  Users,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { PANA_SITES } from '@/lib/panaverse/sites';
import styles from './identity.module.css';
import { cn } from '@/lib/utils';

/**
 * Icons live here rather than in the registry: `lib/panaverse/sites.ts` is
 * dependency-free so the Worker and any future server caller can read it, and
 * importing lucide there would drag a React package into that path.
 */
const SITE_ICONS: Record<string, LucideIcon> = {
  social: MessageCircle,
  ink: PenLine,
  vizion: Video,
  directory: Compass,
  events: CalendarDays,
  getInvolved: Users,
};

/**
 * The destinations block inside the account menu.
 *
 * Sits below the accounts because it answers a later question: you pick who
 * you are speaking as first, then where you are going. An unbuilt site is
 * shown but not linked — see PANA_SITES for why it is named at all.
 *
 * A grid rather than a list, because these are siblings you pick between
 * rather than a sequence you read down — and because six stacked rows were
 * most of the mobile sheet's height on their own.
 */
export function PanaSites({
  onNavigate,
  leading,
}: {
  onNavigate: () => void;
  /**
   * Tiles to place before the sites — in practice the Account tile.
   *
   * It shares this grid rather than sitting in a row of its own because it is
   * the same kind of choice: somewhere to go. That is also why the grid has no
   * heading; "Pana Sites" would be a label the Account tile makes untrue.
   */
  leading?: ReactNode;
}) {
  const { t } = useTranslation('common');

  return (
    <>
      <div className={styles.separator} />

      <div className={styles.tileGrid}>
        {leading}

        {PANA_SITES.map((site) => {
          const Icon = SITE_ICONS[site.id] ?? Compass;
          const label = t(`identity.sites.${site.labelKey}`);

          // Not a link, not focusable, and says why.
          if (!site.href) {
            return (
              <div
                key={site.id}
                className={cn(styles.tile, styles.tileComingSoon)}
                aria-disabled="true"
              >
                <span className={styles.tileIcon} aria-hidden="true">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className={styles.tileLabel}>{label}</span>
                <span className={styles.tileSoon}>
                  {t('identity.comingSoon')}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={site.id}
              href={site.href}
              role="menuitem"
              data-menu-row
              onClick={onNavigate}
              className={styles.tile}
            >
              <span className={styles.tileIcon} aria-hidden="true">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className={styles.tileLabel}>{label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
