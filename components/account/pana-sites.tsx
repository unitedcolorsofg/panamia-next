'use client';

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
 * The "other Pana sites" block inside the account menu.
 *
 * Sits below the accounts because it answers a later question: you pick who
 * you are speaking as first, then where you are going. An unbuilt site is
 * shown but not linked — see PANA_SITES for why it is named at all.
 */
export function PanaSites({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation('common');

  return (
    <>
      <div className={styles.separator} />
      <div className={styles.menuHeading}>{t('identity.panaSites')}</div>

      {PANA_SITES.map((site) => {
        const Icon = SITE_ICONS[site.id] ?? Compass;
        const label = t(`identity.sites.${site.labelKey}`);

        // Not a link, not focusable, and says why: a row that looks clickable
        // and does nothing is worse than one that states it is not ready.
        if (!site.href) {
          return (
            <div
              key={site.id}
              className={cn(styles.row, styles.rowComingSoon)}
              aria-disabled="true"
            >
              <span className={styles.siteIcon} aria-hidden="true">
                <Icon className="h-4 w-4" />
              </span>
              <span className={styles.rowMeta}>
                <span className={styles.rowName}>{label}</span>
              </span>
              <span className={styles.badge}>{t('identity.comingSoon')}</span>
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
            className={styles.row}
          >
            <span className={styles.siteIcon} aria-hidden="true">
              <Icon className="h-4 w-4" />
            </span>
            <span className={styles.rowMeta}>
              <span className={styles.rowName}>{label}</span>
            </span>
          </Link>
        );
      })}
    </>
  );
}
