'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function AccountUserPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      // Redirect to user edit page
      router.replace('/account/user/edit');
    } else if (status === 'unauthenticated') {
      // Redirect to home if not authenticated
      router.replace('/');
    }
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
    </div>
  );
}
