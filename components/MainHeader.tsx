'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useSession, signOut } from '@/lib/auth-client';
import Link from 'next/link';
import Image from 'next/image';
import axios from 'axios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  Home,
  Search,
  UserCircle,
  User,
  MessageCircle,
  Compass,
  Video,
  Users,
  Shield,
  Info,
  Gift,
  Radio,
  LogOut,
  PenLine,
  FileText,
  LayoutGrid,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import styles from './MainHeader.module.css';
import { cn } from '@/lib/utils';
import { useUnreadCount } from '@/lib/query/notifications';
import NotificationAlerts from './NotificationAlerts';
import CallToActionBar from './CallToActionBar';
import NavDrawer, { type NavDrawerItem } from './NavDrawer';
import { ThemeToggle } from './theme-toggle';
import { IdentityProvider } from './account/identity-provider';
import { SURFACES } from '@/lib/panaverse/surfaces';

/**
 * Where joining lands a new member. Read from the surface registry rather than
 * written as '/s' so it follows the social surface if its root ever moves.
 */
const JOIN_DESTINATION =
  SURFACES.find((s) => s.id === 'social')?.rootPath ?? '/s';
import { IdentityMenu } from './account/identity-menu';
import { ActingAsBar } from './account/acting-as-bar';

// https://www.a11ymatters.com/pattern/mobile-nav/

type NavItem = { href: string; labelKey: string; icon: LucideIcon };

// A collapsible module section. `href` is the module root: the heading text is a
// real link there (desktop and mobile), while hover (desktop) or tapping the row
// (mobile) expands the sub-items. Kept at module scope so the array identity is
// stable across renders.
type NavSection = {
  key: string;
  labelKey: string;
  href: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    key: 'directory',
    labelKey: 'nav.directory',
    href: '/directory',
    items: [
      { href: '/directory', labelKey: 'nav.browseDirectory', icon: Compass },
      {
        href: '/directory/search',
        labelKey: 'nav.directorySearch',
        icon: Search,
      },
    ],
  },
  {
    key: 'events',
    labelKey: 'nav.events',
    href: '/e',
    items: [
      { href: '/e', labelKey: 'nav.browseEvents', icon: CalendarDays },
      { href: '/e/new', labelKey: 'nav.hostEvent', icon: CalendarPlus },
    ],
  },
  {
    key: 'articles',
    labelKey: 'nav.articles',
    href: '/a',
    items: [
      { href: '/a', labelKey: 'nav.browseArticles', icon: FileText },
      { href: '/a/new', labelKey: 'nav.writeArticle', icon: PenLine },
    ],
  },
  {
    key: 'mentoring',
    labelKey: 'nav.mentoring',
    href: '/m',
    items: [
      { href: '/m/discover', labelKey: 'nav.discoverMentors', icon: Users },
      { href: '/m/profile/edit', labelKey: 'nav.mentorProfile', icon: Compass },
      { href: '/m/schedule', labelKey: 'nav.mySessions', icon: Video },
    ],
  },
  {
    key: 'community',
    labelKey: 'nav.community',
    href: '/about-us',
    items: [
      { href: '/about-us', labelKey: 'nav.aboutPanaMia', icon: Info },
      { href: '/features', labelKey: 'nav.featuresOverview', icon: LayoutGrid },
      { href: '/donate', labelKey: 'nav.supportUs', icon: Gift },
      { href: '/r', labelKey: 'nav.resilienceNetwork', icon: Radio },
    ],
  },
  {
    key: 'account',
    labelKey: 'nav.myAccount',
    href: '/account',
    items: [
      {
        href: '/account/profile/edit',
        labelKey: 'nav.myProfile',
        icon: UserCircle,
      },
      {
        href: '/account/user/edit',
        labelKey: 'nav.accountSettings',
        icon: User,
      },
    ],
  },
];

export default function MainHeader({
  isProductionSite,
}: {
  isProductionSite: boolean;
}) {
  const { t } = useTranslation('common');
  const { data: session, status } = useSession();
  const handleSignOut = () => signOut({ redirect: true, callbackUrl: '/' });
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  // Get admin status directly from session (no API call needed)
  const isAdmin = session?.user?.isAdmin || false;

  // Unread notifications drive the "Jump To" and Updates cues. Only poll for
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

  const [isMobile, setIsMobile] = useState(false);
  // At most one section is expanded at a time. On desktop this is driven by
  // hover/focus; on mobile it toggles when the heading row is tapped.
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Primary navigation lives in the drawer for every visitor. "My Account" only
  // applies once signed in, so it drops out and the 01..N numbering closes up
  // on its own.
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
    ];
  }, [session?.user, t]);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const isSectionOpen = useCallback(
    (key: string) => activeSection === key,
    [activeSection]
  );

  // Desktop expands on hover (handled by the section wrapper) and the heading is
  // a real link; only intercept taps on mobile to toggle the accordion.
  const toggleSection = useCallback(
    (key: string, e: React.MouseEvent) => {
      if (!isMobile) return;
      e.preventDefault();
      e.stopPropagation();
      setActiveSection((cur) => (cur === key ? null : key));
    },
    [isMobile]
  );

  // Hover (desktop only) and keyboard focus (both) open a section; leaving the
  // wrapper on desktop collapses it.
  const openOnHover = useCallback(
    (key: string) => {
      if (!isMobile) setActiveSection(key);
    },
    [isMobile]
  );
  const closeOnLeave = useCallback(
    (key: string) => {
      if (!isMobile) setActiveSection((cur) => (cur === key ? null : cur));
    },
    [isMobile]
  );

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

  // Render a collapsible module section. The heading links to the module root;
  // hover/focus (desktop) or a tap on the row (mobile) expands the sub-items.
  // The grid-rows animation lives in the CSS module (`.section`/`.sectionOpen`).
  const renderSection = (section: NavSection) => {
    const open = isSectionOpen(section.key);
    return (
      <div
        key={section.key}
        onMouseEnter={() => openOnHover(section.key)}
        onMouseLeave={() => closeOnLeave(section.key)}
        onFocusCapture={() => setActiveSection(section.key)}
      >
        <DropdownMenuLabel
          className="flex cursor-pointer items-center justify-between select-none"
          onClick={(e) => toggleSection(section.key, e)}
        >
          {/* Heading text navigates to the module root; stopPropagation keeps a
              tap from also toggling the accordion on mobile. */}
          <Link
            href={section.href}
            onClick={(e) => e.stopPropagation()}
            className="cursor-pointer hover:underline"
          >
            {t(section.labelKey)}
          </Link>
          <ChevronRight
            className={cn('h-4 w-4 transition-transform', open && 'rotate-90')}
          />
        </DropdownMenuLabel>
        <div className={cn(styles.section, open && styles.sectionOpen)}>
          <div className={styles.sectionInner}>
            {section.items.map((item) => (
              <DropdownMenuItem asChild key={item.href}>
                <Link
                  href={item.href}
                  className="flex cursor-pointer items-center"
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {t(item.labelKey)}
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        </div>
      </div>
    );
  };

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
        {status !== 'loading' && session && hasProfile === false && (
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
              {/* Unauthenticated users: Become a Pana + Sign In */}
              {status !== 'loading' && !session && (
                <>
                  {/* One label, one destination. This pointed at the directory
                    express form while reading "Sign Up" on narrow viewports, so
                    tapping it signed you up and dropped you into a listing form
                    you never chose — the label was the only thing that said
                    "sign up" anywhere in the flow. Joining now creates the
                    account and lands on the feed; "Become a Pana" still opens
                    the directory form from the drawer, homepage and footer. */}
                  <Link
                    href={`/signin?callbackUrl=${encodeURIComponent(JOIN_DESTINATION)}`}
                    className={styles.cta}
                  >
                    {t('nav.signUp')}
                  </Link>
                  <Link href="/signin" className={styles.login}>
                    {t('nav.signIn')}
                  </Link>
                </>
              )}

              {/* Authenticated users: Show Jump To dropdown */}
              {status !== 'loading' && session && (
                <DropdownMenu
                  onOpenChange={(open) => {
                    if (!open) setActiveSection(null);
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="default"
                      variant="outline"
                      data-no-wobble="true"
                      className={cn(
                        'relative',
                        hasUnread && 'border-pink-400 dark:border-pink-500'
                      )}
                    >
                      {t('nav.jumpTo')}
                      <ChevronDown className="ml-2 h-4 w-4" />
                      {hasUnread && (
                        <span
                          className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 animate-pulse items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-medium text-white"
                          aria-label={`${unreadCount} unread updates`}
                        >
                          {unreadLabel}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {/* Pinned primary destinations — always visible, no collapse. */}
                    <DropdownMenuLabel>{t('nav.explore')}</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/"
                        className="flex cursor-pointer items-center"
                      >
                        <Home className="mr-2 h-4 w-4" />
                        {t('nav.home')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/updates"
                        onClick={requestDesktopPermission}
                        className={cn(
                          'flex cursor-pointer items-center',
                          hasUnread &&
                            'font-medium text-pink-600 dark:text-pink-400'
                        )}
                      >
                        <Bell
                          className={cn(
                            'mr-2 h-4 w-4',
                            hasUnread && 'animate-pulse text-pink-500'
                          )}
                        />
                        {t('nav.updates')}
                        {hasUnread && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-500 px-1.5 text-xs font-medium text-white">
                            {unreadLabel}
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/timeline"
                        className="flex cursor-pointer items-center"
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        {t('nav.timelinePosts')}
                      </Link>
                    </DropdownMenuItem>

                    {/* Collapsible module sections — hover to expand (desktop),
                  tap the row to expand (mobile). */}
                    {NAV_SECTIONS.map((section) => (
                      <Fragment key={section.key}>
                        <DropdownMenuSeparator />
                        {renderSection(section)}
                      </Fragment>
                    ))}

                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link
                            href="/account/admin/users"
                            className="flex cursor-pointer items-center"
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            {t('nav.adminPanel')}
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="flex cursor-pointer items-center"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('nav.signOut')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <IdentityMenu />
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
                {/* Mirrors the masthead sign-in link, which is hidden on narrow
                  viewports to keep the logo centered. */}
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
              <p className={styles.drawerMeta}>{t('nav.regions')}</p>
            )
          }
        />
      </header>
    </IdentityProvider>
  );
}
