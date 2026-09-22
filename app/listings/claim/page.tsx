'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

/**
 * Landing page for the confirmation link in the claim email.
 *
 * The redemption happens on mount because arriving here already means the
 * person opened a one-time link from the business inbox — asking them to press
 * another button proves nothing extra.
 */
function ClaimContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  );
  const [message, setMessage] = useState('');
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus('error');
        setMessage('This link is missing its token. Open it from the email.');
        return;
      }

      try {
        const response = await fetch('/api/listings/claim/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setBusinessName(data.businessName || '');
        } else {
          setStatus('error');
          setMessage(data.error || 'Could not complete the claim.');
        }
      } catch (error) {
        console.error('Claim verification failed:', error);
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      }
    };

    run();
  }, [token]);

  return (
    <div className="auth-surface flex flex-col items-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-lg">
        <Card className="border-pana-ink/10 rounded-2xl shadow-xl dark:border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-black tracking-tight">
              {status === 'loading' && (
                <>
                  <Loader2 className="text-pana-flame h-5 w-5 animate-spin" />
                  Confirming…
                </>
              )}
              {status === 'success' && (
                <>
                  <CheckCircle2 className="text-pana-flame h-5 w-5" />
                  It&apos;s yours
                </>
              )}
              {status === 'error' && (
                <>
                  <XCircle className="text-pana-red h-5 w-5" />
                  Couldn&apos;t confirm
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {status === 'loading' && (
              <p className="text-pana-ink/75 dark:text-muted-foreground">
                Checking your link.
              </p>
            )}

            {status === 'success' && (
              <>
                <p className="text-pana-ink/75 dark:text-muted-foreground">
                  {businessName ? (
                    <>
                      You now manage{' '}
                      <strong className="text-pana-ink dark:text-foreground">
                        {businessName}
                      </strong>{' '}
                      on Pana MIA. Add photos, categories and your neighborhood
                      whenever you&apos;re ready.
                    </>
                  ) : (
                    'You now manage this listing on Pana MIA.'
                  )}
                </p>
                <Button
                  asChild
                  className="bg-pana-flame text-pana-ink hover:bg-pana-burnt w-full font-extrabold"
                >
                  <Link href="/account">Go to my account</Link>
                </Button>
              </>
            )}

            {status === 'error' && (
              <>
                <p className="text-pana-ink/75 dark:text-muted-foreground">
                  {message}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="border-pana-ink/15 w-full font-semibold"
                >
                  <Link href="/d">Back to the directory</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ClaimListingPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-surface flex items-center justify-center px-4 py-24">
          <Loader2 className="text-pana-flame h-6 w-6 animate-spin" />
        </div>
      }
    >
      <ClaimContent />
    </Suspense>
  );
}
