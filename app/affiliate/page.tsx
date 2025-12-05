'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Local } from '@/lib/localstorage';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

function AffiliateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;

    // Handle affiliate code from query params
    const affiliate = searchParams.get('code');
    if (affiliate) {
      console.log('affiliate', affiliate);
      Local.set('affiliate', affiliate, 24 * 14); // consume the affiliate code for 14 days
    }

    // Handle redirect parameter
    const redirectTo = searchParams.get('to');
    if (redirectTo) {
      const redirect_key = redirectTo.toUpperCase();
      if (redirect_key === 'BECOMEAPANA') {
        console.log('Redirect:BECOMEAPANA');
        setTimeout(() => {
          router.replace('/form/become-a-pana');
        }, 250);
        return;
      }
    }

    // Default redirect to homepage
    setTimeout(() => {
      router.replace('/');
    }, 250);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/20">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <Loader2
            className="h-12 w-12 animate-spin text-pana-blue"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold">Redirecting...</h1>
          <p className="text-muted-foreground">
            Please wait while we process your affiliate link
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AffiliatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/20">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <Loader2
                className="h-12 w-12 animate-spin text-pana-blue"
                aria-hidden="true"
              />
              <h1 className="text-2xl font-bold">Loading...</h1>
            </CardContent>
          </Card>
        </div>
      }
    >
      <AffiliateContent />
    </Suspense>
  );
}
