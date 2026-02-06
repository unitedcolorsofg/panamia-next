/**
 * New Article Page
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Create new community article
 */

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ArticleEditor from '@/components/ArticleEditor';
import ScreennamePrompt from '@/components/ScreennamePrompt';
import Link from 'next/link';
import { useProfileGuard } from '@/hooks/use-profile-guard';

export default function NewArticlePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { requireProfile } = useProfileGuard();
  const [showScreennamePrompt, setShowScreennamePrompt] = useState(false);
  const [hasScreenname, setHasScreenname] = useState<boolean | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin?callbackUrl=/articles/new');
    }
  }, [status, router]);

  // Check for profile
  useEffect(() => {
    async function checkProfile() {
      if (session?.user?.email) {
        try {
          const response = await fetch('/api/getProfile');
          const data = await response.json();
          // API returns { success: true, data: { id: ... } }
          const profileExists = !!data?.data?.id;
          setHasProfile(profileExists);

          if (!profileExists) {
            requireProfile(false, 'write articles');
            router.push('/form/become-a-pana?from=articles');
          }
        } catch {
          setHasProfile(false);
          requireProfile(false, 'write articles');
          router.push('/form/become-a-pana?from=articles');
        }
      }
    }

    if (session) {
      checkProfile();
    }
  }, [session, router, requireProfile]);

  // Check for screenname (only if profile exists)
  useEffect(() => {
    async function checkScreenname() {
      if (session?.user?.email && hasProfile) {
        try {
          const response = await fetch('/api/user/me');
          const data = await response.json();
          if (data.success && data.data) {
            setHasScreenname(!!data.data.screenname);
            if (!data.data.screenname) {
              setShowScreennamePrompt(true);
            }
          }
        } catch (error) {
          console.error('Failed to check screenname:', error);
        }
      }
    }

    if (session && hasProfile) {
      checkScreenname();
    }
  }, [session, hasProfile]);

  if (
    status === 'loading' ||
    hasProfile === null ||
    (hasProfile && hasScreenname === null)
  ) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
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
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              You must be signed in to create articles.
            </p>
            <Button asChild>
              <Link href="/signin?callbackUrl=/articles/new">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <ScreennamePrompt
        open={showScreennamePrompt}
        onOpenChange={setShowScreennamePrompt}
        onSuccess={() => {
          setHasScreenname(true);
          setShowScreennamePrompt(false);
        }}
        title="Set Your Screenname"
        description="Before creating articles, you need to choose a screenname. This will be displayed as your author name on all your contributions."
      />

      {hasProfile && hasScreenname && <ArticleEditor mode="create" />}
    </main>
  );
}
