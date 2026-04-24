'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';

const EventEditor = dynamic(() => import('@/components/EventEditor'), {
  loading: () => (
    <p className="text-muted-foreground py-12 text-center">Loading editor...</p>
  ),
});
import Link from 'next/link';

export default function NewEventPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin?callbackUrl=/e/new');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              You must be signed in to host an event.
            </p>
            <Button asChild>
              <Link href="/signin?callbackUrl=/e/new">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <EventEditor mode="create" />
    </main>
  );
}
