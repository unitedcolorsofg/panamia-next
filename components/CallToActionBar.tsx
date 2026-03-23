'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import styles from './CallToActionBar.module.css';
import { Button } from '@/components/ui/button';

interface CallToActionBarProps {
  variant?: 'newsletter' | 'complete-profile';
  isProductionSite: boolean;
}

export default function CallToActionBar({
  variant = 'newsletter',
  isProductionSite,
}: CallToActionBarProps) {
  const { t } = useTranslation('common');

  // Authenticated user without profile - prompt to complete profile
  if (variant === 'complete-profile') {
    return (
      <div className={styles.callToAction}>
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <span className="hidden-sm">{t('cta.tellUsMore')} &nbsp;</span>
          <Button
            variant="default"
            size="default"
            className="bg-gradient-to-r from-pink-500 to-purple-600 font-semibold text-white shadow-lg hover:from-pink-600 hover:to-purple-700"
            asChild
          >
            <Link href="/form/become-a-pana">
              {t('cta.completeYourProfile')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Unauthenticated user - newsletter signup or test site warning
  return (
    <div className={styles.callToAction}>
      {isProductionSite ? (
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <span className="hidden-sm">{t('cta.stayUpdated')} &nbsp;</span>
          <Button
            variant="default"
            size="default"
            className="bg-gradient-to-r from-pink-500 to-purple-600 font-semibold text-white shadow-lg hover:from-pink-600 hover:to-purple-700"
            asChild
          >
            <a href="#newsletter-signup">{t('cta.signUpNewsletter')}</a>
          </Button>
        </div>
      ) : (
        <div className="-ml-40 flex flex-col items-start gap-2 sm:ml-0 sm:flex-row sm:items-center">
          <span className="text-lg font-bold">{t('cta.visitingTestSite')}</span>
          <Button
            variant="default"
            size="default"
            className="bg-gradient-to-r from-pink-500 to-purple-600 font-semibold text-white shadow-lg hover:from-pink-600 hover:to-purple-700"
            asChild
          >
            <a href="https://www.panamia.club">{t('cta.visitPanamiaClub')}</a>
          </Button>
        </div>
      )}
    </div>
  );
}
