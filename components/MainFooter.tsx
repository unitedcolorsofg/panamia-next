'use client';

import {
  IconBrandInstagram,
  IconBrandYoutube,
  IconBrandLinkedin,
  IconCode,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import PanaLogo from './PanaLogo';
import styles from './MainFooter.module.css';

export default function GlobalFooter() {
  const { t } = useTranslation('common');
  return (
    <footer className={styles.footer} id="footer">
      <div className={styles.footerInner}>
        <PanaLogo color="pink" size="medium" />
        <ul className={styles.footerLinks}>
          <li>
            <strong>{t('footer.panaMia')}</strong>
          </li>
          <li>
            <Link href="/podcasts">{t('footer.panaVizion')}</Link>
          </li>
          <li>
            <Link href="/about-us">{t('footer.about')}</Link>
          </li>
          <li>
            <Link href="/links">{t('footer.links')}</Link>
          </li>
          <li>
            <Link href="/directory/search">{t('footer.directorio')}</Link>
          </li>
          <li>
            <Link href="/form/join-the-team/">{t('footer.joinTheTeam')}</Link>
          </li>
        </ul>
        <ul className={styles.footerLinksAlt}>
          <li>
            <strong>{t('footer.users')}</strong>
          </li>
          <li hidden>
            <Link href="/signin">{t('nav.signUp')}</Link>
          </li>
          <li>
            <Link href="/form/become-a-pana">{t('footer.becomeAPana')}</Link>
          </li>
          <li>
            <Link href="/form/contact-us">{t('footer.contactUs')}</Link>
          </li>
        </ul>
        <div className={styles.socials}>
          <ul>
            <li>
              <a href="https://instagram.com/goto.panamia.club">
                <IconBrandInstagram size={32} stroke={1.5} />
                <span className="sr-only">{t('footer.instagram')}</span>
              </a>
            </li>
            <li>
              <a href="https://www.youtube.com/@panavizion305">
                <IconBrandYoutube size={32} stroke={1.5} />
                <span className="sr-only">{t('footer.youtube')}</span>
              </a>
            </li>
            <li>
              <a href="https://www.linkedin.com/company/pana-mia/">
                <IconBrandLinkedin size={32} stroke={1.5} />
                <span className="sr-only">{t('footer.linkedIn')}</span>
              </a>
            </li>
            <li>
              <a href="https://github.com/panamiaclub/panamia.club">
                <IconCode size={32} stroke={1.5} />
                <span className="sr-only">{t('footer.sourceCode')}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className={styles.termsLink}>
        <Link href="/doc/terms-and-conditions">
          {t('footer.termsAndConditions')}
        </Link>
      </div>
    </footer>
  );
}
