'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';

export default function AccountUserPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      // Redirect to user edit page
      router.replace('/account/user/edit');
    } else if (status === 'unauthenticated') {
      // Redirect to sign in page
      router.replace('/api/auth/signin?callbackUrl=/account/user/edit');
    }
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
    </div>
  );
}
