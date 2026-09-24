'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useSession, signOut } from '@/lib/auth-client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import axios from 'axios';

import styles from './MainHeader.module.css';
import { isOnboardingRoute } from '@/lib/onboarding';
import { useUnreadCount } from '@/lib/query/notifications';
import NotificationAlerts from './NotificationAlerts';
import CallToActionBar from './CallToActionBar';
import NavDrawer, { type NavDrawerItem } from './NavDrawer';
import { ThemeToggle } from './theme-toggle';
import { IdentityProvider } from './account/identity-provider';
import { AuthMenu } from './account/auth-menu';
import { ActingAsBar } from './account/acting-as-bar';

// https://www.a11ymatters.com/pattern/mobile-nav/

// A primary navigation destination. `href` is the module root. Kept at module
// scope so the array identity is stable across renders.
type NavSection = {
  key: string;
  labelKey: string;
  href: string;
};

const NAV_SECTIONS: NavSection[] = [
  { key: 'directory', labelKey: 'nav.directory', href: '/directory' },
  { key: 'events', labelKey: 'nav.events', href: '/e' },
  { key: 'articles', labelKey: 'nav.articles', href: '/a' },
  { key: 'mentoring', labelKey: 'nav.mentoring', href: '/m' },
  { key: 'community', labelKey: 'nav.community', href: '/about-us' },
  { key: 'account', labelKey: 'nav.myAccount', href: '/account' },
];

export default function MainHeader({
  isProductionSite,
}: {
  isProductionSite: boolean;
}) {
  const { t } = useTranslation('common');
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  // Get admin status directly from session (no API call needed)
  const isAdmin = session?.user?.isAdmin || false;

  // Unread notifications drive the Updates cue in the drawer. Only poll for
  // signed-in users.
  const { data: unreadCount = 0 } = useUnreadCount({
    enabled: !!session?.user,
  });
  const hasUnread = unreadCount > 0;
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  // One-time opt-in for desktop notifications, tied to a click (a user
  // gesture): opening Updates signals interest in being alerted. No-op if the
  // user already granted or denied.
  const requestDesktopPermission = useCallback(() => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      void Notification.requestPermission();
    }
  }, []);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Primary navigation lives in the drawer for every visitor. "My Account" only
  // applies once signed in, so it drops out and the 01..N numbering closes up
  // on its own. Updates, Timeline and the admin panel are appended here because
  // the masthead "Jump To" menu that used to carry them is gone -- the drawer is
  // now the only way to reach them.
  const drawerItems = useMemo<NavDrawerItem[]>(() => {
    const sections = NAV_SECTIONS.filter(
      (section) => section.key !== 'account' || !!session?.user
    );
    return [
      { href: '/', label: t('nav.home') },
      ...sections.map((section) => ({
        href: section.href,
        label: t(section.labelKey),
      })),
      ...(session?.user
        ? [
            {
              href: '/updates',
              label: hasUnread
                ? `${t('nav.updates')} (${unreadLabel})`
                : t('nav.updates'),
              onSelect: requestDesktopPermission,
            },
            { href: '/timeline', label: t('nav.timelinePosts') },
          ]
        : []),
      ...(isAdmin
        ? [{ href: '/account/admin/users', label: t('nav.adminPanel') }]
        : []),
    ];
  }, [
    session?.user,
    isAdmin,
    hasUnread,
    unreadLabel,
    requestDesktopPermission,
    t,
  ]);

  // Check if authenticated user has a profile
  useEffect(() => {
    if (session?.user) {
      axios
        .get('/api/getProfile')
        .then((res) => {
          // Profile exists if we get data back with an id
          // API returns { success: true, data: { id: ... } }
          setHasProfile(!!res.data?.data?.id);
        })
        .catch(() => {
          setHasProfile(false);
        });
    }
    // When session is null, hasProfile remains null (initial state)
    // The CTA bar only shows for authenticated users anyway
  }, [session]);

  return (
    <IdentityProvider enabled={status !== 'loading' && !!session}>
      <header className={styles.header}>
        {/* Ambient unread cues: browser-tab count + desktop notifications */}
        <NotificationAlerts />
        {/* CTA bar: newsletter for unauthenticated, profile completion for authenticated without profile */}
        {status !== 'loading' && !session && (
          <div id="call-to-action-bar">
            <CallToActionBar isProductionSite={isProductionSite} />
          </div>
        )}
        {status !== 'loading' &&
          session &&
          hasProfile === false &&
          !isOnboardingRoute(pathname) && (
            <div id="call-to-action-bar">
              <CallToActionBar
                variant="complete-profile"
                isProductionSite={isProductionSite}
              />
            </div>
          )}
        {/* Centered masthead: menu (left) · logo (center) · actions (right) */}
        <div className={styles.masthead}>
          <div className={styles.mastheadInner}>
            <div className={styles.mastheadLeft}>
              <button
                type="button"
                className={styles.menuButton}
                onClick={() => setDrawerOpen(true)}
                aria-expanded={drawerOpen}
                aria-haspopup="dialog"
              >
                <span className={styles.bars} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className={styles.menuLabel}>{t('nav.menu')}</span>
              </button>
            </div>

            <Link
              href="/"
              className={styles.mastheadLogo}
              aria-label="Pana Mia"
            >
              <Image
                src="/logos/pana_logo_long_orange.png"
                alt="Pana Mia"
                width={600}
                height={150}
                priority
              />
            </Link>

            <div className={styles.mastheadRight}>
              {/* Unauthenticated users: one control, one panel. It used to be
                  a "Sign Up" pill beside a "Sign In" link, which asked a
                  visitor to classify themselves before anything had explained
                  the difference — and this site is passwordless, so there is
                  no real difference to explain: the account is created the
                  first time you use a magic link. The pair also cost the right
                  column the width the `1fr auto 1fr` grid needs to keep the
                  logo on the page axis, which is why the sign-in link was
                  hidden below 560px and narrow phones were left with a lone
                  "Sign Up". */}
              {status !== 'loading' && !session && (
                <AuthMenu triggerClassName={styles.cta} />
              )}

              <ThemeToggle />
            </div>
          </div>

          {/* Sits inside the sticky masthead so the reminder travels with it. */}
          <ActingAsBar />
        </div>

        <NavDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          items={drawerItems}
          title={t('nav.menu')}
          closeLabel={t('nav.closeMenu')}
          footer={
            status !== 'loading' && !session ? (
              <>
                <Link
                  href="/form/become-a-pana"
                  className={styles.drawerCta}
                  onClick={closeDrawer}
                >
                  {t('nav.becomeAPana')}
                </Link>
                {/* Mirrors the masthead sign-in button, which stays visible at
                  every width — this is the in-drawer path to the same page. */}
                <p className={styles.drawerLogin}>
                  <Trans
                    i18nKey="nav.alreadyAPana"
                    t={t}
                    components={{
                      a: <Link href="/signin" onClick={closeDrawer} />,
                    }}
                  />
                </p>
                <p className={styles.drawerMeta}>{t('nav.regions')}</p>
              </>
            ) : (
              <>
                {/* Sign Out had no home once the masthead identity menu was
                    removed, and it exists nowhere else in the app. Settings
                    rides along because it sat directly above it there. */}
                <div className={styles.drawerAccount}>
                  <Link
                    href="/account/user/edit"
                    className={styles.drawerAccountLink}
                    onClick={closeDrawer}
                  >
                    {t('nav.accountSettings')}
                  </Link>
                  <button
                    type="button"
                    className={styles.drawerAccountLink}
                    onClick={() => {
                      closeDrawer();
                      void signOut({ redirect: true, callbackUrl: '/' });
                    }}
                  >
                    {t('nav.signOut')}
                  </button>
                </div>
                <p className={styles.drawerMeta}>{t('nav.regions')}</p>
              </>
            )
          }
        />
      </header>
    </IdentityProvider>
  );
}
