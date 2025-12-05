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
      <div id="call-to-action-bar">
        <CallToActionBar />
      </div>
    </header>
  );
}
