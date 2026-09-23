'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Check, LogOut, Plus, Settings, UserPlus } from 'lucide-react';

import { signOut } from '@/lib/auth-client';
import { useIdentity, type Identity } from './identity-provider';
import { MenuSurface } from './menu-surface';
import { PanaSites } from './pana-sites';
import styles from './identity.module.css';
import { cn } from '@/lib/utils';

/** Up to two initials, so "Café Curú" reads as CC rather than C. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function Avatar({ identity, large }: { identity: Identity; large?: boolean }) {
  return (
    <span
      className={cn(
        styles.avatar,
        !identity.isPersonal && styles.avatarBusiness,
        large && styles.avatarLg
      )}
      aria-hidden="true"
    >
      {initialsOf(identity.name ?? '?')}
    </span>
  );
}

/**
 * The "acting as" menu in the masthead.
 *
 * One login can administer several profiles — the person's own, plus any
 * business listing they own or help run. This is where you choose which of
 * them the rest of the app speaks for, and — below that choice — where the
 * rest of the Pana world is listed.
 *
 * The frame itself (dropdown on desktop, bottom sheet on phones) lives in
 * MenuSurface, which the signed-out menu wears too, so the control a visitor
 * meets before they have an account is the one they keep afterwards.
 */
export function IdentityMenu() {
  const { t } = useTranslation('common');
  const identity = useIdentity();

  const active = identity?.active ?? null;

  /* Only the absence of a provider hides this. It deliberately does *not* bail
     on an empty identity list: a member who has just signed in for the first
     time has no profile yet, and this menu is where Sign Out lives. Hiding it
     from them would leave them with no way out of an account they only just
     created. MainHeader is what keeps it away from signed-out visitors. */
  if (!identity) return null;

  const { identities, activeId, switching, error, failed, loading, switchTo } =
    identity;

  // Only claim the account is unfinished once we have actually heard back.
  const needsSetup = !loading && !failed && identities.length === 0;

  return (
    <MenuSurface
      label={
        active
          ? `${t('identity.switchAccount')} — ${active.name}`
          : t('identity.switchAccount')
      }
      triggerClassName={styles.trigger}
      trigger={
        active ? (
          <Avatar identity={active} />
        ) : (
          <span className={styles.avatar} aria-hidden="true">
            ?
          </span>
        )
      }
    >
      {(close) => {
        async function onPick(profileId: string) {
          close(false);
          if (profileId !== activeId) await switchTo(profileId);
        }

        return (
          <>
            {identities.length > 0 && (
              <div className={styles.menuHeading}>{t('identity.actingAs')}</div>
            )}

            {identities.map((item) => {
              const isActive = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  data-menu-row
                  disabled={switching !== null}
                  onClick={() => onPick(item.id)}
                  className={cn(styles.row, isActive && styles.rowActive)}
                >
                  <Avatar identity={item} />
                  <span className={styles.rowMeta}>
                    <span className={styles.rowName}>{item.name}</span>
                    <span className={styles.rowHandle}>
                      {item.screenname
                        ? `@${item.screenname}`
                        : item.isPersonal
                          ? t('identity.you')
                          : t('identity.business')}
                    </span>
                  </span>

                  {item.active === false && (
                    <span className={styles.badge}>
                      {t('identity.inactive')}
                    </span>
                  )}
                  {item.isPersonal ? (
                    <span className={styles.badge}>{t('identity.you')}</span>
                  ) : (
                    <span className={styles.badge}>
                      {item.role === 'manager'
                        ? t('identity.manager')
                        : t('identity.owner')}
                    </span>
                  )}

                  {switching === item.id ? (
                    <span className={styles.spinner} aria-hidden="true" />
                  ) : isActive ? (
                    <Check className={styles.check} aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}

            {/* Takes the place of the account list for someone who has signed
                in but never claimed a handle. Without it the menu would open
                on nothing but Sign Out, with no hint as to why the account
                looks empty. */}
            {needsSetup && (
              <Link
                href="/welcome"
                role="menuitem"
                data-menu-row
                onClick={() => close(false)}
                className={styles.row}
              >
                <span className={styles.addIcon} aria-hidden="true">
                  <UserPlus className="h-4 w-4" />
                </span>
                <span className={styles.rowMeta}>
                  <span className={styles.rowName}>
                    {t('onboarding.finishSetup')}
                  </span>
                  <span className={styles.rowHandle}>
                    {t('onboarding.finishSetupHint')}
                  </span>
                </span>
              </Link>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.separator} />

            <Link
              href="/form/list-your-business"
              role="menuitem"
              data-menu-row
              onClick={() => close(false)}
              className={styles.row}
            >
              <span className={styles.addIcon} aria-hidden="true">
                <Plus className="h-4 w-4" />
              </span>
              <span className={styles.rowMeta}>
                <span className={styles.rowName}>
                  {t('identity.listBusiness')}
                </span>
                <span className={styles.rowHandle}>
                  {t('identity.listBusinessHint')}
                </span>
              </span>
            </Link>

            {/* Everything above is "who am I"; everything below is "where am
                I going". */}
            <PanaSites onNavigate={() => close(false)} />

            <div className={styles.separator} />

            <Link
              href="/account/user/edit"
              role="menuitem"
              data-menu-row
              onClick={() => close(false)}
              className={cn(styles.row, styles.rowQuiet)}
            >
              <Settings className="h-4 w-4 opacity-70" aria-hidden="true" />
              <span className={styles.rowMeta}>
                <span className={styles.rowName}>{t('identity.settings')}</span>
              </span>
            </Link>

            {/* Last, and tinted, because it is the one row here you cannot undo
                by clicking again — and it sits directly under Settings, which
                is where the cursor already is. */}
            <button
              type="button"
              role="menuitem"
              data-menu-row
              onClick={() => {
                close(false);
                void signOut({ redirect: true, callbackUrl: '/' });
              }}
              className={cn(styles.row, styles.rowQuiet, styles.rowSignOut)}
            >
              <LogOut className="h-4 w-4 opacity-70" aria-hidden="true" />
              <span className={styles.rowMeta}>
                <span className={styles.rowName}>{t('nav.signOut')}</span>
              </span>
            </button>
          </>
        );
      }}
    </MenuSurface>
  );
}
