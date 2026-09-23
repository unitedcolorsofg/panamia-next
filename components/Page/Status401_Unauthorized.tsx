'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import PageMeta from '../PageMeta';
import StatusFullPage from './FullPage';
import styles from './Status401_Unauthorized.module.css';

export default function Status401_Unauthorized() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Redirect to the branded sign-in page. This pointed at
    // /api/auth/signin, which is a NextAuth convention that does not exist in
    // better-auth -- measured 404 in production against /api/auth/ok 200, so
    // the handler is mounted and this path simply is not one of its routes.
    const callbackUrl = encodeURIComponent(pathname || '/account/user');
    router.replace(`/signin?callbackUrl=${callbackUrl}`);
  }, [router, pathname]);

  return (
    <main className={styles.app}>
      <PageMeta title="Unauthorized" desc="401 Unauthorized" />
      <StatusFullPage>
        <div className={styles.main}>
          <h2 className={styles.accountTitle}>UNAUTHORIZED</h2>
          <h3 className={styles.accountTitle}>
            You must be logged in to view this page. Redirecting to sign in...
          </h3>
        </div>
      </StatusFullPage>
    </main>
  );
}
