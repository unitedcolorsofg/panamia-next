'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import NavDrawer, { type NavDrawerItem } from '@/components/NavDrawer';

/**
 * The MENU control in a surface masthead.
 *
 * `SurfaceMemberHeader` is a server component — it resolves cross-surface
 * origins where PANAVERSE_ROOT_DOMAIN actually exists — so the drawer's open
 * state has to live in a client island. The items are
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
  const { t, i18n } = useTranslation();
  const isEs = i18n.language === 'es';
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
          /* The language switch is all this footer carries. Account Settings
             and Sign Out moved up to the masthead identity menu when Pana
             Social adopted the main site's account bubble, which is where that
             menu keeps them — and keeping a second copy here would be two
             Sign Outs in one shell to hold in step.

             The switch itself sits outside any signed-in branch for the same
             reason it does on the main site: it used to live in the theme
             menu, which #188 removed, and it is not an account control — a
             visitor reading the feed signed out still needs it. */
          <div className="panaverse-drawer-account">
            <button
              type="button"
              onClick={() => {
                void i18n.changeLanguage(isEs ? 'en' : 'es');
                close();
              }}
            >
              {isEs ? 'in English' : 'en Español'}
            </button>
          </div>
        }
      />
    </>
  );
}
