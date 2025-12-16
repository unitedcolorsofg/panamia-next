'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  IconFileDescription,
  IconDashboard,
  IconEdit,
} from '@tabler/icons-react';

import styles from './AdminHeader.module.css';
import AdminButton from './AdminButton';

export default function AdminMenu() {
  const pathname = usePathname();

  function checkActive(href: String) {
    if (pathname === href) {
      return true;
    }
    return false;
  }

  return (
    <header className={styles.adminMenu}>
      <div className={styles.menuBlock}>
        <ul className={styles.menuLinkList}>
          <li className={styles.menuDesc}>ADMIN MENU</li>
          <li>
            <AdminButton href="/account/admin">
              <IconDashboard height="16" />
              Dashboard
            </AdminButton>
          </li>
          <li>
            <AdminButton href="/account/admin/podcasts">
              <IconFileDescription height="16" />
              Podcasts
            </AdminButton>
          </li>
          <li>
            <AdminButton href="/account/admin/signups">
              <IconEdit height="16" />
              Newsletter
            </AdminButton>
          </li>
          <li>
            <AdminButton href="/account/admin/contactus">
              <IconEdit height="16" />
              Contact Us
            </AdminButton>
          </li>
          <li>
            <AdminButton href="/account/admin/users">
              <IconEdit height="16" />
              Users
            </AdminButton>
          </li>
        </ul>
      </div>
    </header>
  );
}
