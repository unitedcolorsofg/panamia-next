'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useSession, signOut } from '@/lib/auth-client';
import NavDrawer, { type NavDrawerItem } from '@/components/NavDrawer';

/**
 * The MENU control in a surface masthead.
 *
 * `SurfaceMemberHeader` is a server component — it resolves cross-surface
 * origins where PANAVERSE_ROOT_DOMAIN actually exists — so the drawer's open
 * state and the sign-out call have to live in a client island. The items are
 * built on the server and arrive already resolved, which is what keeps the
 * cross-surface hrefs honest: computing them here would mean guessing the root
 * domain from the browser.
 *
 * Reuses the main site's NavDrawer rather than growing a second one. The panel,
 * the focus trap and the scroll-lock are behaviour both surfaces should share;
 * the only thing that legitimately differs is which links go in it.
 */
export function SurfaceMenu({
  items,
  mark,
}: {
  items: NavDrawerItem[];
  /** The surface's wordmark, for the drawer head. Passed down rather than
   *  looked up here so the drawer never has to know which surface it is in. */
  mark: { src: string; alt: string; width: number; height: number };
}) {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        className="panaverse-menu-button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="panaverse-menu-bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="panaverse-menu-label">{t('nav.menu')}</span>
      </button>

      <NavDrawer
        open={open}
        onClose={close}
        items={items}
        mark={mark}
        title={t('nav.menu')}
        closeLabel={t('nav.closeMenu')}
        footer={
          /* Sign Out exists in exactly one place in this app — a drawer footer.
             The main site put it here when its identity menu was retired, and
             Pana Social had no route to it at all: a member signed in on the
             feed could not sign out without going back to the main site. */
          status !== 'loading' && session ? (
            <div className="panaverse-drawer-account">
              <Link href="/account/user/edit" onClick={close}>
                {t('nav.accountSettings')}
              </Link>
              <button
                type="button"
                onClick={() => {
                  close();
                  void signOut({ redirect: true, callbackUrl: '/' });
                }}
              >
                {t('nav.signOut')}
              </button>
            </div>
          ) : null
        }
      />
    </>
  );
}
