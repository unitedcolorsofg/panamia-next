'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession, signOut } from '@/lib/auth-client';
import Link from 'next/link';
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

import styles from './MainHeader.module.css';
import { cn } from '@/lib/utils';
import { useUnreadCount } from '@/lib/query/notifications';
import NotificationAlerts from './NotificationAlerts';
import CallToActionBar from './CallToActionBar';
import { ThemeToggle } from './theme-toggle';

// https://www.a11ymatters.com/pattern/mobile-nav/

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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const isSectionOpen = useCallback(
    (key: string) => (isMobile ? (openSections[key] ?? false) : true),
    [isMobile, openSections]
  );

  const toggleSection = useCallback(
    (key: string, e: React.MouseEvent) => {
      if (!isMobile) return;
      e.preventDefault();
      e.stopPropagation();
      setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
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

  return (
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
      {/* Top-right navigation buttons */}
      <div className="fixed top-13 right-2 z-50 flex flex-wrap gap-2 md:top-4 md:right-4">
        {/* Unauthenticated users: Show Become a Pana and Sign In buttons */}
        {status !== 'loading' && !session && (
          <>
            <Button
              size="default"
              variant="outline"
              asChild
              className="h-10 px-4"
            >
              <Link href="/form/become-a-pana">
                <span className="hidden md:inline">{t('nav.becomeAPana')}</span>
                <span className="md:hidden">{t('nav.signUp')}</span>
              </Link>
            </Button>
            <Button
              size="default"
              variant="outline"
              asChild
              className="h-10 px-4"
            >
              <Link href="/signin">{t('nav.signIn')}</Link>
            </Button>
          </>
        )}

        {/* Authenticated users: Show Jump To dropdown */}
        {status !== 'loading' && session && (
          <DropdownMenu
            onOpenChange={(open) => {
              if (!open) setOpenSections({});
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
              <DropdownMenuLabel>{t('nav.explore')}</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/" className="flex cursor-pointer items-center">
                  <Home className="mr-2 h-4 w-4" />
                  {t('nav.home')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/features"
                  className="flex cursor-pointer items-center"
                >
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  {t('nav.featuresOverview')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/updates"
                  onClick={requestDesktopPermission}
                  className={cn(
                    'flex cursor-pointer items-center',
                    hasUnread && 'font-medium text-pink-600 dark:text-pink-400'
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
              <DropdownMenuItem asChild>
                <Link
                  href="/directory/search"
                  className="flex cursor-pointer items-center"
                >
                  <Search className="mr-2 h-4 w-4" />
                  {t('nav.directorySearch')}
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel
                className="flex cursor-pointer items-center justify-between select-none md:cursor-default"
                onClick={(e) => toggleSection('events', e)}
              >
                {t('nav.events')}
                {isMobile && (
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${isSectionOpen('events') ? 'rotate-90' : ''}`}
                  />
                )}
              </DropdownMenuLabel>
              {isSectionOpen('events') && (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/e"
                      className="flex cursor-pointer items-center"
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {t('nav.browseEvents')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/e/new"
                      className="flex cursor-pointer items-center"
                    >
                      <CalendarPlus className="mr-2 h-4 w-4" />
                      {t('nav.hostEvent')}
                    </Link>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuLabel
                className="flex cursor-pointer items-center justify-between select-none md:cursor-default"
                onClick={(e) => toggleSection('articles', e)}
              >
                {/* Header doubles as a link to the author's article dashboard;
                    stopPropagation so clicking the text navigates rather than
                    toggling the section on mobile. */}
                <Link
                  href="/account/articles"
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer hover:underline"
                >
                  {t('nav.articles')}
                </Link>
                {isMobile && (
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${isSectionOpen('articles') ? 'rotate-90' : ''}`}
                  />
                )}
              </DropdownMenuLabel>
              {isSectionOpen('articles') && (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/a"
                      className="flex cursor-pointer items-center"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {t('nav.browseArticles')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/a/new"
                      className="flex cursor-pointer items-center"
                    >
                      <PenLine className="mr-2 h-4 w-4" />
                      {t('nav.writeArticle')}
                    </Link>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuLabel
                className="flex cursor-pointer items-center justify-between select-none md:cursor-default"
                onClick={(e) => toggleSection('mentoring', e)}
              >
                {isSectionOpen('mentoring') ? (
                  <Link href="/m">{t('nav.mentoring')}</Link>
                ) : (
                  t('nav.mentoring')
                )}
                {isMobile && (
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${isSectionOpen('mentoring') ? 'rotate-90' : ''}`}
                  />
                )}
              </DropdownMenuLabel>
              {isSectionOpen('mentoring') && (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/m/discover"
                      className="flex cursor-pointer items-center"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      {t('nav.discoverMentors')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/m/profile/edit"
                      className="flex cursor-pointer items-center"
                    >
                      <Compass className="mr-2 h-4 w-4" />
                      {t('nav.mentorProfile')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/m/schedule"
                      className="flex cursor-pointer items-center"
                    >
                      <Video className="mr-2 h-4 w-4" />
                      {t('nav.mySessions')}
                    </Link>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuLabel
                className="flex cursor-pointer items-center justify-between select-none md:cursor-default"
                onClick={(e) => toggleSection('account', e)}
              >
                {t('nav.myAccount')}
                {isMobile && (
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${isSectionOpen('account') ? 'rotate-90' : ''}`}
                  />
                )}
              </DropdownMenuLabel>
              {isSectionOpen('account') && (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/account/profile/edit"
                      className="flex cursor-pointer items-center"
                    >
                      <UserCircle className="mr-2 h-4 w-4" />
                      {t('nav.myProfile')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/account/user/edit"
                      className="flex cursor-pointer items-center"
                    >
                      <User className="mr-2 h-4 w-4" />
                      {t('nav.accountSettings')}
                    </Link>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t('nav.community')}</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  href="/about-us"
                  className="flex cursor-pointer items-center"
                >
                  <Info className="mr-2 h-4 w-4" />
                  {t('nav.aboutPanaMia')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/donate"
                  className="flex cursor-pointer items-center"
                >
                  <Gift className="mr-2 h-4 w-4" />
                  {t('nav.supportUs')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/r" className="flex cursor-pointer items-center">
                  <Radio className="mr-2 h-4 w-4" />
                  {t('nav.resilienceNetwork')}
                </Link>
              </DropdownMenuItem>

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
        <ThemeToggle />
      </div>
    </header>
  );
}
