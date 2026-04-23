'use client';

import {
  IconFileDescription,
  IconDashboard,
  IconEdit,
  IconUsers,
  IconArticle,
  IconCalendar,
} from '@tabler/icons-react';

import styles from './AdminHeader.module.css';
import AdminButton from './AdminButton';

export default function AdminMenu() {
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
            <AdminButton href="/account/admin/articles">
              <IconArticle height="16" />
              Articles
            </AdminButton>
          </li>
          <li>
            <AdminButton href="/account/admin/podcasts">
              <IconFileDescription height="16" />
              Podcasts
            </AdminButton>
          </li>
          <li>
            <AdminButton href="/account/admin/mentoring">
              <IconUsers height="16" />
              Mentoring
            </AdminButton>
          </li>
          <li>
            <AdminButton href="/account/admin/events">
              <IconCalendar height="16" />
              Events
            </AdminButton>
          </li>
          <li>
            <AdminButton href="/venues">
              <IconCalendar height="16" />
              Venues
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
