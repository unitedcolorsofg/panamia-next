'use client';

import { useTranslation } from 'react-i18next';

import { useIdentity } from './identity-provider';
import styles from './identity.module.css';
import { cn } from '@/lib/utils';

/**
 * A standing reminder, shown under the masthead whenever you are acting as a
 * business rather than as yourself.
 *
 * Deliberately not dismissible. The one genuinely costly mistake this feature
 * can cause is posting in the wrong voice, and a banner you can wave away stops
 * protecting you the moment it matters. It slides rather than pops so the page
 * below is not yanked out from under the cursor.
 */
export function ActingAsBar() {
  const { t } = useTranslation('common');
  const identity = useIdentity();

  const active = identity?.active ?? null;
  const personal = identity?.personal ?? null;
  const showing = Boolean(active && !active.isPersonal);

  return (
    <div
      className={cn(styles.actingSlot, showing && styles.actingSlotOpen)}
      aria-hidden={!showing}
    >
      <div className={styles.actingInner}>
        <div className={styles.acting} role={showing ? 'status' : undefined}>
          <span className={styles.actingDot} aria-hidden="true" />
          <span>
            <span className={styles.actingLong}>{t('identity.actingAs')} </span>
            <span className={styles.actingName}>{active?.name}</span>
          </span>
          {personal && (
            <button
              type="button"
              className={styles.actingBack}
              disabled={identity?.switching !== null}
              onClick={() => identity?.switchTo(personal.id)}
            >
              {t('identity.backToYou')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
