'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import classNames from 'classnames';
import {
  IconHome,
  IconUser,
  IconLogout,
  IconAlien,
  IconSettings,
  IconUsers,
  IconPlaylistAdd,
} from '@tabler/icons-react';
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
  ChevronDown,
  Home,
  Search,
  UserCircle,
  User,
  Heart,
  List,
  Compass,
  Video,
  Users,
  Shield,
  Info,
  Gift,
  LogOut,
  PenLine,
  FileText,
} from 'lucide-react';

import styles from './MainHeader.module.css';
import CallToActionBar from './CallToActionBar';
import PanaLogo from './PanaLogo';
import PanaButton from './PanaButton';
import { ThemeToggle } from './theme-toggle';

// https://www.a11ymatters.com/pattern/mobile-nav/

const menu_items = [
  { id: 'home', link: '/', label: 'Home', icon: '' },
  { id: 'about', link: '/about-us', label: 'About' },
  { id: 'search', link: '/directory/search', label: 'Search' },
  { id: 'donations', link: '/donate', label: 'Donate', special: false },
];

// {id:"links", link: "/links", label: "Links"},
// {id:"event", link: "https://shotgun.live/events/serotonin-dipity-mini-fest", label: "EVENT!", special: true},

interface MenuItemProps {
  id: string;
  label: string;
  url: string;
  icon?: string;
  special?: boolean;
}

interface IconProps {
  reference?: string;
}

export default function MainHeader() {
  const { data: session, status } = useSession();
  const handleSignOut = () => signOut({ redirect: true, callbackUrl: '/' });
  const [menu_active, setMenuActive] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const activeClasses = classNames(styles.navList, styles.navListActive);

  // Get admin status directly from session (no API call needed)
  const isAdmin = session?.user?.isAdmin || false;

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

  interface NavStyle {
    padding?: string;
  }

  interface LogoStyle {
    size?: string;
  }
  const [scrollPosition, setScrollPosition] = useState(0);
  const [navStyle, setNavStyle] = useState<NavStyle>({});
  const [logoStyle, setLogoStyle] = useState<LogoStyle>({});

  /*
    We're setting this value but not using it. This script is causing the header
    element to re-render on every scroll. If we need this we could maybe look
    a non use-effect solution.
    useEffect(() => {
        const handleScroll = () => {
            const newScrollPosition = window.scrollY;
            setScrollPosition(newScrollPosition);
        };
    
        window.addEventListener('scroll', handleScroll);
    
        return () => {
          window.removeEventListener('scroll', handleScroll);
        };
      }, [scrollPosition]);
      */

  function onBurgerClick() {
    const burger = document.getElementById('mainheader-toggle') as Element;
    const burger_icon = burger.querySelector('span.burger-icon') as Element;
    const menu = document.getElementById('mainheader-menu') as Element;

    if (menu_active === true) {
      setMenuActive(false);
      burger_icon.classList.remove('close');
      menu.setAttribute('aria-expanded', 'false');
    } else {
      setMenuActive(true);
      burger_icon.classList.add('close');
      menu.setAttribute('aria-expanded', 'true');
    }
    return true;
  }

  function onMenuClick() {
    const burger = document.getElementById('mainheader-toggle') as Element;
    const burger_icon = burger.querySelector('span.burger-icon') as Element;
    const menu = document.getElementById('mainheader-menu') as Element;

    setMenuActive(false);
    burger_icon.classList.remove('close');
    menu.setAttribute('aria-expanded', 'false');
    return true;
  }

  async function onUserClick(e: React.MouseEvent) {
    e.stopPropagation();
    const dialogUser = document.getElementById(
      'dialog-user-mainheader'
    ) as HTMLDialogElement;
    if (dialogUser.open) {
      dialogUser.close();
    } else {
      dialogUser.show();
    }
  }

  async function onUserDialogClick(e: React.MouseEvent) {
    e.stopPropagation();
  }

  function Icon(props: IconProps): React.JSX.Element {
    if (props.reference == 'home') {
      return <IconHome height="20" width="20" />;
    }
    return <></>;
  }

  function MenuItem(props: MenuItemProps): React.JSX.Element {
    return (
      <li className={styles.listItem}>
        <Link
          href={props.url}
          onClick={onMenuClick}
          className={props?.special == true ? styles.linkSpecial : ''}
        >
          <Icon reference={props.icon} />
          {props.label}
        </Link>
      </li>
    );
  }

  const menu_elements = menu_items.map((item) => {
    return (
      <MenuItem
        key={item.id}
        id={item.id}
        label={item.label}
        url={item.link}
        special={item.special}
        icon={item.icon}
      />
    );
  });

  return (
    <header className={styles.header}>
      {/* CTA bar: newsletter for unauthenticated, profile completion for authenticated without profile */}
      {status !== 'loading' && !session && (
        <div id="call-to-action-bar">
          <CallToActionBar />
        </div>
      )}
      {status !== 'loading' && session && hasProfile === false && (
        <div id="call-to-action-bar">
          <CallToActionBar variant="complete-profile" />
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
                <span className="hidden md:inline">Become a Pana</span>
                <span className="md:hidden">Sign Up</span>
              </Link>
            </Button>
            <Button
              size="default"
              variant="outline"
              asChild
              className="h-10 px-4"
            >
              <Link href="/api/auth/signin">Sign In</Link>
            </Button>
          </>
        )}

        {/* Authenticated users: Show Jump To dropdown */}
        {status !== 'loading' && session && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="default" variant="outline" data-no-wobble="true">
                Jump To
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Navigation</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/" className="flex cursor-pointer items-center">
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/account/notifications"
                  className="flex cursor-pointer items-center"
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/directory/search"
                  className="flex cursor-pointer items-center"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Directory Search
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  href="/account/profile/edit"
                  className="flex cursor-pointer items-center"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  My Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/account/user/edit"
                  className="flex cursor-pointer items-center"
                >
                  <User className="mr-2 h-4 w-4" />
                  Account Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/account/user/following"
                  className="flex cursor-pointer items-center"
                >
                  <Heart className="mr-2 h-4 w-4" />
                  Following
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/account/user/lists"
                  className="flex cursor-pointer items-center"
                >
                  <List className="mr-2 h-4 w-4" />
                  My Lists
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Mentoring</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  href="/mentoring/discover"
                  className="flex cursor-pointer items-center"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Discover Mentors
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/mentoring/profile/edit"
                  className="flex cursor-pointer items-center"
                >
                  <Compass className="mr-2 h-4 w-4" />
                  Mentor Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/mentoring/schedule"
                  className="flex cursor-pointer items-center"
                >
                  <Video className="mr-2 h-4 w-4" />
                  My Sessions
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Articles</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  href="/articles"
                  className="flex cursor-pointer items-center"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Browse Articles
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/articles/new"
                  className="flex cursor-pointer items-center"
                >
                  <PenLine className="mr-2 h-4 w-4" />
                  Write Article
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Community</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  href="/about-us"
                  className="flex cursor-pointer items-center"
                >
                  <Info className="mr-2 h-4 w-4" />
                  About Pana Mia
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/donate"
                  className="flex cursor-pointer items-center"
                >
                  <Gift className="mr-2 h-4 w-4" />
                  Support Us
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
                      Admin Panel
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
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
