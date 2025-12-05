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
} from '@tabler/icons';
import axios from 'axios';

import styles from './MainHeader.module.css';
import CallToActionBar from './CallToActionBar';
import { getUserSession } from '../lib/user';
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
  console.log('MainHeader');
  const { data: session, status } = useSession();
  const handleSignOut = () => signOut({ redirect: true, callbackUrl: '/' });
  const [menu_active, setMenuActive] = useState(false);
  const activeClasses = classNames(styles.navList, styles.navListActive);
  const [isAdmin, setIsAdmin] = useState(false);

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
    const userSessionData = await getUserSession();
    // console.log("userSession", userSession);
    if (userSessionData?.status?.role == 'admin') {
      setIsAdmin(true);
    }
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
          className={props?.special == true ? styles.linkSpecial : ''}>

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
      <div id="call-to-action-bar">
        <CallToActionBar />
      </div>
      <div className={styles.navWrap}>
        <nav role="navigation" className={styles.nav} style={navStyle}>
          <div className={styles.navLogo}>
            <Link href="/">
              {/* @next-codemod-error This Link previously used the now removed `legacyBehavior` prop, and has a child that might not be an anchor. The codemod bailed out of lifting the child props to the Link. Check that the child component does not render an anchor, and potentially move the props manually to Link. */
              }
              <img src="/logos/pana_logo_long_pink.png" />
            </Link>
          </div>
          <button
            onClick={onBurgerClick}
            className={styles.burger}
            id="mainheader-toggle"
            aria-expanded="false"
            aria-controls="menu"
          >
            <span className="burger-icon"></span>
            <span className="sr-only">Open Menu</span>
          </button>
          <ul
            id="mainheader-menu"
            className={menu_active ? activeClasses : styles.navList}
          >
            {menu_elements}
          </ul>
          {session && session.user && (
            <div className={styles.sessionButton}>
              <button onClick={onUserClick}>
                <IconUser />
              </button>
            </div>
          )}
          {!session && (
            <div className={styles.sessionButton}>
              <PanaButton
                text="Sign Up"
                color="blue"
                hoverColor="blue"
                href="/api/auth/signin"
              />
            </div>
          )}
          <div className={styles.sessionButton}>
            <ThemeToggle />
          </div>
        </nav>
        <div className={styles.navBorder}></div>
        <dialog
          id="dialog-user-mainheader"
          className={styles.userModal}
          onClick={onUserDialogClick}
        >
          {session && session.user && (
            <div>
              <span className={styles.userModalUser}>{session.user.email}</span>
              <hr />
              <ul>
                {isAdmin && (
                  <li className={styles.adminLink}>
                    <Link href="/account/admin">

                      <IconAlien height="16" width="16" />ADMIN
                                            
                    </Link>
                  </li>
                )}
                <li>
                  <Link href="/account/user">

                    <IconSettings height="16" width="16" />Account
                                        
                  </Link>
                </li>
                <li>
                  <Link href="/account/user/following">

                    <IconUsers height="16" width="16" />Following

                  </Link>
                </li>
                <li>
                  <Link href="/mentoring/discover">

                    <IconUsers height="16" width="16" />Mentoring

                  </Link>
                </li>
                {isAdmin && (
                  <li>
                    <Link href="/account/user/lists">

                      <IconPlaylistAdd height="16" width="16" />Lists

                    </Link>
                  </li>
                )}
                <li>
                  <Link href="/api/auth/signout">

                    <IconLogout height="16" width="16" />Sign Out
                                        
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </dialog>
      </div>
    </header>
  );
}
